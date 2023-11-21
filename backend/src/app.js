const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const cors = require("cors");
const config = require('./config/config')
const http = require("http")
const socketIo = require("socket.io")
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { fromEnv } = require("@aws-sdk/credential-providers")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const multer = require("multer")
const dotenv = require("dotenv")
const fs = require('fs');
const path = require('path');

let {Chat_Model,Customers_Model, Admin_Chat_Model, Customer_Chat_Model, Usernames_Model} = require('../models/modelAssociations');
const { Admins_Model } = require("../models/models");

const cookieParser = require('cookie-parser')

dotenv.config()

const app = express()
app.use(cors({
  origin: "*",
  credentials: true,
}));
app.use(morgan('combined')) //logs connections
app.use(bodyParser.json())
app.use(cookieParser())

const ChatServer = http.createServer(app);
const io = socketIo(ChatServer, {
  cors: {
    origin: "*",
    credentials: true,
  }
});


const uploadDir = '/tmp/uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

//Database
const database = config.database

//({ force: true }) - This creates the table, dropping it first if it already existed
/*
({ alter: true }) - This checks what is the current state of the table in the database (which columns it has, what are their data types, etc), 
and then performs the necessary changes in the table to make it match the model.
*/
database.sync(console.log("Beginning Database Synchronization.."))
.then(() => console.log("Database Synchronized..."))
.catch(err => console.log('Error: ', err))

//Database connection test
database.authenticate()
.then(() => console.log("Database Connected..."))
.catch(err => console.log('Error: ', err))


const getOrCreateChatRoom = async (customOrderID) => {
  let chatID;
  try {
    const chat = await Chat_Model.findOne({ where: { CustomOrderID: customOrderID } });
    if (chat) {
      chatID = chat.ChatID;
    } else {
      const newChat = await Chat_Model.create({ CustomOrderID: customOrderID });
      chatID = newChat.ChatID;
    }
  } catch (error) {
    console.error('Error getting or creating chat room:', error);
    throw error;
  }
  return chatID;
};


io.on('connection', (socket) => {
  // Listen for room joining with role information, CustomOrderID, and username
  socket.on('join room', async (data) => {
    console.log('Join room event received:', data);
    try {
      const { CustomOrderID, role, username } = data;

      // Perform a lookup in the Usernames table to get CustomerID or AdminID based on the provided username
      let userIDField;
      if (role === 'customer') {
        userIDField = 'CustomerID';
      } else if (role === 'admin') {
        userIDField = 'AdminID';
      }

      try {
        const user = await Usernames_Model.findOne({ where: { Username: username } });
        if (!user) {
          // Handle the case when the user is not found based on the provided username
          socket.emit('chat message', { text: 'Invalid username.' });
          return;
        }

        const userID = user[userIDField];

        // Retrieve or create chat room and get chatID
        const chatID = await getOrCreateChatRoom(CustomOrderID);

        // Join the specified room with the retrieved or newly created ChatID
        socket.join(chatID);

        // Emit a welcome message based on the user's role
        socket.emit('chat message', { text: `Welcome! Username: ${username} CustomerOrderID: ${CustomOrderID} Role: ${role} CustomerID: ${userID} ChatID: ${chatID}.` });
      } catch (error) {
        console.error('Error searching for user:', error);
      }
    } catch (error) {
      console.error('Error handling join room event:', error);
    }
  });

    // Listen for new messages in the room
    socket.on('chat message', async (data) => {
      try {
        const { customOrderID, role, username, message } = data;
        
        // Retrieve or create chat room and get chatID
        const chatID = await getOrCreateChatRoom(customOrderID);
  
        Usernames_Model.findOne({ where: { Username: username } })
          .then((user) => {
            if (!user) {
              socket.emit('chat message', { text: 'Invalid username.' });
              return;
            }
            
            let userIDField;
            if (role === 'customer') {
              userIDField = 'CustomerID';
            } else if (role === 'admin') {
              userIDField = 'AdminID';
            }

            const userID = user[userIDField];
  
            if (role === 'customer') {
              Customer_Chat_Model.create({
                ChatID: chatID,
                CustomerID: userID,
                CustomerMessages: message,
              })
                .then(() => {
                  io.to(chatID).emit('chat message', {
                    message,
                    role,
                    userID,
                    chatID,
                    username,
                    createdAt: new Date(),
                  });
                })
                .catch((error) => {
                  console.error('Error saving customer message:', error);
                });
            } else if (role === 'admin') {
              Admin_Chat_Model.create({
                ChatID: chatID,
                AdminID: userID,
                AdminMessages: message,
              })
                .then(() => {
                  io.to(chatID).emit('chat message', {
                    message,
                    role,
                    userID,
                    chatID,
                    username,
                    createdAt: new Date(),
                  });
                })
                .catch((error) => {
                  console.error('Error saving admin message:', error);
                });
            }
          })
          .catch((error) => {
            console.error('Error searching for user:', error);
          });
      } catch (error) {
        console.error('Error handling chat message event:', error);
      }
    });

    socket.on('image upload', async (data) => {
      try {
        const { image, customOrderID, username, role } = data;
    
        const s3 = new S3Client({
          region: process.env.BUCKET_REGION,
          credentials: fromEnv(),
        });
    
        // Generate a unique filename for the image
        const imageFileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    
        // Convert from base64 to buffer
        const buffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    
        // Upload the image to S3 bucket using PutObjectCommand
        const params = {
          Bucket: process.env.BUCKET_NAME,
          Key: imageFileName,
          Body: buffer,
          ContentType: 'image/png',
        };
    
        // Use S3Client to upload the image
        const uploadResult = await s3.send(new PutObjectCommand(params));
    
        if (uploadResult.$metadata.httpStatusCode === 200) {

          const imageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${imageFileName}`;
          
          console.log(imageUrl)
          // Retrieve or create chat room and get chatID
          const chatID = await getOrCreateChatRoom(customOrderID);
    
          Usernames_Model.findOne({ where: { Username: username } })
          .then((user) => {
            if (!user) {
              socket.emit('chat message', { text: 'Invalid username.' });
              return;
            }
            
            let userIDField;
            if (role === 'customer') {
              userIDField = 'CustomerID';
            } else if (role === 'admin') {
              userIDField = 'AdminID';
            }

            const userID = user[userIDField];
  
            if (role === 'customer') {
              Customer_Chat_Model.create({
                ChatID: chatID,
                CustomerID: userID,
                CustomerMessages: imageUrl,
              })
                .then(() => {
                  io.to(chatID).emit('image message', { imageUrl });
                })
                .catch((error) => {
                  console.error('Error saving customer message:', error);
                });
            } else if (role === 'admin') {
              Admin_Chat_Model.create({
                ChatID: chatID,
                AdminID: userID,
                AdminMessages: imageUrl,
              })
                .then(() => {
                  io.to(chatID).emit('image message', { imageUrl });
                })
                .catch((error) => {
                  console.error('Error saving admin message:', error);
                });
            }
          })
        
        } else {
          console.error('Error uploading image to S3:', uploadResult);
        }
      } catch (error) {
        console.error('Error handling image upload:', error);
      }
    })
  });




//imports the routes and sets up the middle ware for the routes on /test
//localhost:PORT/test

app.use('/', require('../routes/routes'))
app.use('/customerData', require('../routes/customerRoutes'))
app.use('/adminData', require('../routes/adminRoutes'))

ChatServer.listen(config.PORT, console.log("Server started listening on port : ", config.PORT));






//error handler
app.use(function (err, req, res, next) {
    // logs error and error code to console
    console.error(err.message, req);
    if (!err.statusCode)
      err.statusCode = 500;
    res.status(err.statusCode).send(err.message);
  });

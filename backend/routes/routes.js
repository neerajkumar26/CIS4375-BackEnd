const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const secret_key = process.env.JWT_SECRET

let {Usernames_Model, Passwords_Model, Customers_Model, Admins_Model, Chat_Model, Customer_Chat_Model, Admin_Chat_Model, City_Model, State_Model
} = require('../models/modelAssociations')

const { createToken, validateToken } = require('../src/auth/JWT')

//SignUp
router.post('/SignUp', async (req, res) => {

  try {

    const hashedPassword = await bcrypt.hash(req.body.Password, 10)

    // Find CityID by City name
    const city = await City_Model.findOne({
      where: {
          City: req.body.City,
        },
    });

    // Find StateID by State name
    const state = await State_Model.findOne({
        where: {
            State: req.body.State,
        },
    });

    if (!city || !state) {
        return res.status(404).json({ message: 'City or State not found' });
    }

    //Adds Customer's information to Customers Table
    const customer = await Customers_Model.create({
      CityID: city.CityID,
      StateID: state.StateID,
      ZipCode: req.body.ZipCode,
      CustomerLastName: req.body.CustomerLastName,
      CustomerFirstName: req.body.CustomerFirstName,
      CustomerAddress: req.body.CustomerAddress,
      CustomerPhone: req.body.CustomerPhone,
      CustomerEmail: req.body.CustomerEmail
    });

    // Create username for the customer
    const usernames = await Usernames_Model.create({
      CustomerID: customer.CustomerID,
      Username: req.body.Username
    });

    // Create password for the customer (hashed)
    await Passwords_Model.create({
      CustomerID: customer.CustomerID,
      Password: hashedPassword
    });

    // Generate JWT token for the newly registered user
    const token = jwt.sign({ userId: customer.CustomerID, username: usernames.Username }, secret_key, { expiresIn: '1h' });

    // Send response with token and success message
    res.status(201).json({ message: 'SignUp successful', token: token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


//Login
router.post('/Login', async (req, res) => {
  try {
      const { Username, Password } = req.body;
      
      // Check if the username exists in either customers or admins table
      const customer = await Usernames_Model.findOne({
        where: {
            Username: Username,
        },
        include: [
            {
                model: Customers_Model,
                required: false, // Use false for LEFT JOIN
            },
            {
                model: Admins_Model,
                required: false, // Use false for LEFT JOIN
            },
        ],
    });
    
    if (customer) {
        // Determine user type and ID
        let userType, userId;
        if (customer.CUSTOMER) {
            userType = 'customer';
            userId = customer.CUSTOMER.CustomerID;
        } else if (customer.ADMIN) {
            userType = 'admin';
            userId = customer.ADMIN.AdminID;
        } else {
            // Handle case where the username exists but is not associated with a customer or admin
            return res.status(401).json({ message: 'Invalid user' });
        }
    
        // Verify password
        let matchedPassword;
    
        if (userType === 'customer') {
            matchedPassword = await Passwords_Model.findOne({
                where: {
                    CustomerID: userId,
                },
            });
        } else if (userType === 'admin') {
            // Lookup password in Admins_Model table based on AdminID
            matchedPassword = await Passwords_Model.findOne({
                where: {
                    AdminID: userId,
                },
            });
        }
    
        if (matchedPassword && (await bcrypt.compare(Password, matchedPassword.Password))) {
            // Password matches, generate JWT token
            const token = createToken({ userId, username: Username, userType });
    
            res.cookie('access-token', token, {
              httpOnly: true,
              sameSite: 'none',
              secure: false,
              maxAge: 3600000, // 1 Hour in milliseconds
              domain: 'localhost'
            });

            res.status(200).json({ message: 'Login successful', token: token, role: userType });
        } else {
            res.status(401).json({ message: 'Incorrect password' });
        }
    } else {
        res.status(404).json({ message: 'Username not found' });
    }
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});

//Logout
router.post('/Logout', validateToken, async (req, res) => {
  try {
    const { userId, username, role } = req.user;
      
      // Check if the username exists in either customers or admins table
      const customer = await Usernames_Model.findOne({
        where: {
            Username: username,
        },
        include: [
            {
                model: Customers_Model,
                required: false, // Use false for LEFT JOIN
            },
            {
                model: Admins_Model,
                required: false, // Use false for LEFT JOIN
            },
        ],
    });
    
    if (customer) {

      const token = ''

      res.cookie('access-token', token, {
        httpOnly: true,
        sameSite: 'none',
        secure: false,
        maxAge: 0,
        domain: 'localhost'
      });

      res.status(200).json({ message: 'Logout successful', token: token});

      } else {
          return res.status(401).json({ message: 'Invalid user' });
      }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
    });

router.get('/UserInformation', validateToken, (req, res) => {
  // Access user information from the token payload
  const { userId, username, role } = req.user;

  // Return user information in the response
  res.json({ userId, username, role });
});


//Get all Passwords
router.get('/Passwords', (req, res) =>
    Passwords_Model.findAll()
    .then(passwords => {
        res.json(passwords);
    })
    .catch(err => console.log(err)));

//Get all Usernames
router.get('/Usernames', (req, res) =>
    Usernames_Model.findAll()
    .then(usernames => {
        res.json(usernames);
    })
    .catch(err => console.log(err)));

  // Chat history 
  router.get('/chat-history/:customOrderID', async (req, res) => {
    console.log('Received a request for chat history');
    try {

      const chat = await Chat_Model.findOne({
        where: {
          CustomOrderID: req.params.customOrderID
        }
      });
      
      if (!chat) {
        return res.status(404).json({ error: 'Chat history not found for the provided CustomOrderID' });
      }
      
      const { ChatID } = chat.dataValues;
      
      const customerMessages = await Customer_Chat_Model.findAll({
        where: {
          ChatID: ChatID
        },
        include: {
          model: Customers_Model,
        include: {
          model: Usernames_Model,
          attributes: [
            'Username'
          ]
          }}
      });

      const adminMessages = await Admin_Chat_Model.findAll({
        where: {
          ChatID: ChatID
        },
        include: [
          {
            model: Admins_Model,
            include: [
              {
                model: Usernames_Model,
                attributes: ['Username']
              }
            ]
          }
        ]
      });

      // Deconstruct, combine and sort messages based on timestamps
      const allMessages = [...customerMessages, ...adminMessages].sort((a, b) => a.createdAt - b.createdAt);
  
      res.status(200).json(allMessages);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

module.exports = router;
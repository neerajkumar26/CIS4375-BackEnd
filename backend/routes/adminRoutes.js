const express = require("express");
const Sequelize = require('sequelize')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const moment = require('moment');
const secret_key = process.env.JWT_SECRET
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temporarily stores file
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromEnv } = require("@aws-sdk/credential-providers");


const router = express.Router();

let {Admins_Model, Custom_Products_Model, Custom_Products_Order_Model} = require('../models/modelAssociations')
let {Products_Model} = require('../models/modelAssociations')
let {Customers_Model} = require('../models/modelAssociations')
let {Status_Model} = require('../models/modelAssociations')
let {State_Model} = require('../models/modelAssociations')
let {City_Model} = require('../models/modelAssociations')
let {Usernames_Model} = require('../models/modelAssociations')
let {Passwords_Model} = require('../models/modelAssociations')
let {Feedback_Model} = require('../models/modelAssociations')
let {Custom_Orders_Model} = require('../models/modelAssociations')
let {Orders_Model} = require('../models/modelAssociations')
let {Order_Products_Model} = require('../models/modelAssociations')

//GET all Admins
router.get('/', (req, res) =>
    Admins_Model.findAll()
    .then(admins => {
        res.json(admins);
    })
    .catch(err => console.log(err)));

// GET all Customers with State and City names
router.get('/Customers', (req, res) => {
    Customers_Model.findAll({
        include: [
            {
                model: State_Model,
                attributes: ['State'],
                where: {
                    StateID: Sequelize.col('CUSTOMERS.StateID')
                },
                required: false // Use 'false' if you want a LEFT JOIN, 'true' for INNER JOIN
            },
            {
                model: City_Model,
                attributes: ['City'],
                where: {
                    CityID: Sequelize.col('CUSTOMERS.CityID')
                },
                required: false // Use 'false' if you want a LEFT JOIN, 'true' for INNER JOIN
            }
        ]
    })
    .then(customers => {
        res.json(customers);
    })
    .catch(err => {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
});


//Get Product Details
router.get('/Products/:id', async (req, res) => {
    try {
  
        const ProductDetails = await Products_Model.findOne({
        where: {
            ProductID: req.params.id,
        },
        });

        res.status(200).json({ ProductDetails });

    } catch (err) {
        console.log(err)
    }
  });

//GET all Products
router.get('/Products', (req, res) =>
    Products_Model.findAll()
    .then(products => {
        res.json(products);
    })
    .catch(err => console.log(err)));

// POST endpoint for uploading a product
router.post('/Products', upload.single('ProductImage'), async (req, res) => {

    // Set up the S3 client
    const s3 = new S3Client({
    region: process.env.BUCKET_REGION,
    credentials: fromEnv(),
    });

    try {
        const { ProductName, ProductType, ProductColor, ProductSize, ProductPrice, ProductStock } = req.body;

        // Check if the ProductImage is undefined
        if (!req.file) {
            return res.status(400).json({ message: 'No image provided' });
        }

        console.log('Uploaded File:', req.file); // Log the uploaded file to debug

        // Read the file from the local file system
        const fileContent = fs.readFileSync(req.file.path);

        // Prepare the S3 upload parameters
        const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: req.file.filename, // You might want to add a file extension based on the mimetype
            Body: fileContent,
            ContentType: req.file.mimetype,
        };

        // Upload the file to S3
        const uploadResult = await s3.send(new PutObjectCommand(params));
        if (uploadResult.$metadata.httpStatusCode === 200) {
            // The image was uploaded successfully
            
            const imageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${req.file.filename}`;

            // Create the product with the S3 image URL instead of the base64 string
            const newProduct = await Products_Model.create({
                ProductName,
                ProductType,
                ProductColor,
                ProductSize,
                ProductPrice,
                ProductStock,
                ProductImage: imageUrl,
            });

            res.status(200).json({ message: 'Product Added', product: newProduct });

            // Delete the local file after uploading to S3
            fs.unlinkSync(req.file.path);

        } else {
            throw new Error('Failed to upload image to S3');
        }
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to add product', error: err.message });
        // Delete the local file if there was an error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
    }
});

// Updating a Product
router.put('/Products/:productId', upload.single('ProductImage'), async (req, res) => {
    const productId = req.params.productId;
    const { ProductName, ProductType, ProductColor, ProductSize, ProductPrice, ProductStock } = req.body;

    // Set up the S3 client
    const s3 = new S3Client({
        region: process.env.BUCKET_REGION,
        credentials: fromEnv(),
    });

    try {
        let imageUrl;
        if (req.file) {
            // Read the file from the local file system
            const fileContent = fs.readFileSync(req.file.path);

            // Prepare the S3 upload parameters
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: req.file.filename, // Consider adding a unique identifier (like the product ID) to the filename
                Body: fileContent,
                ContentType: req.file.mimetype,
            };

            // Upload the new image to S3
            const uploadResult = await s3.send(new PutObjectCommand(params));
            if (uploadResult.$metadata.httpStatusCode !== 200) {
                throw new Error('Failed to upload image to S3');
            }

            imageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${req.file.filename}`;
            
            // Delete the local file after uploading to S3
            fs.unlinkSync(req.file.path);
        }

        // Update the product with Sequelize
        const updateValues = { ProductName, ProductType, ProductColor, ProductSize, ProductPrice, ProductStock };

        if (imageUrl) {
            updateValues.ProductImage = imageUrl;
        }

        const [numberOfAffectedRows] = await Products_Model.update(updateValues, {
            where: {
                ProductID: productId // This should match the primary key column name in your table
            }
        });

        if (numberOfAffectedRows > 0) {
            res.status(200).json({ message: 'Product Updated' });
        } else {
            res.status(404).json({ message: 'Product Not Found' });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update product', error: err.message });

        // Delete the local file if there was an error and a file was uploaded
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
    }
});

// Deleting a Product
router.delete('/Products/:productId', async (req, res) => {
    const productId = req.params.productId; // Ensure this is a number in the actual request
    console.log(`Attempting to delete product with ID: ${productId}`);

    try {
        // Find the product to check if it exists before deletion
        const product = await Products_Model.findByPk(productId);
        console.log('Found product:', product);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Delete the product with Sequelize
        const deletedProduct = await Products_Model.destroy({
            where: {
                ProductID: productId // This needs to match your model's primary key
            }
        });
        console.log('Delete operation result:', deletedProduct);

        if (deletedProduct) {
            res.status(200).json({ message: 'Product Deleted' });
        } else {
            // This condition might never be true since findByPk would have already returned null if the product didn't exist
            res.status(404).json({ message: 'Product Not Found' });
        }
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to delete product', error: err.message });
    }
});

// //Update a Product
// router.put('/Products/:id', async (req, res) => {
//     try {
  
//         const product = await Products_Model.findOne({
//         where: {
//             ProductID: req.params.id,
//         },
//         });
        
//         if (product) {
//         const updatedFields = {};
//         const tableFields = ['ProductName', 'ProductType', 'ProductColor', 'ProductSize', 'ProductPrice', 'ProductStock', 'ProductImage'];

//         tableFields.forEach(field => {
//             if (req.body[field] !== undefined) {
//                 updatedFields[field] = req.body[field];
//             }
//         });

//         Products_Model.update(updatedFields,{
//             where: {
//             ProductID: product.ProductID
//             },
//         });

//         res.status(200).json({ message: 'Product Updated' });

//     }} catch (err) {
//         console.log(err)
//     }
//   });

// //Delete a Product
// router.delete('/Products', async (req, res) => {
//     try {
  
//         const product = await Products_Model.findOne({
//         where: {
//             ProductName: req.body.ProductName,
//         },
//         });
        
//         if (product) {
//         Products_Model.destroy(
//             {
//             where: {
//             ProductID: product.ProductID,
//             ProductName: req.body.ProductName,
//             },
//         });

//         res.status(200).json({ message: 'Product Deleted' });

//     }} catch (err) {
//         console.log(err)
//     }
//   });


//Get All Orders
router.get('/Orders', async (req, res) => {
    try {
        const Orders = await Orders_Model.findAll({
            include: [
                {
                    model: State_Model,
                    attributes: ['State'] // Include only the State attribute from State_Model
                },
                {
                    model: City_Model,
                    attributes: ['City'] // Include only the City attribute from City_Model
                },
                {
                    model: Status_Model,
                    attributes: ['Status'] // Include only the Status attribute from Status_Model
                }
            ]
        });

        if (Orders && Orders.length > 0) {
            res.status(200).json({ Orders });
        } else {
            res.status(401).json({ message: 'No Orders' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Get Order Details
router.get('/Orders/:id', async (req, res) => {
    try {
        const OrderDetails = await Orders_Model.findOne({
            where: {
                OrderID: req.params.id
            },
            include: [
                {
                    model: State_Model,
                    attributes: ['State'] // Include only the State attribute from State_Model
                },
                {
                    model: City_Model,
                    attributes: ['City'] // Include only the City attribute from City_Model
                },
                {
                    model: Status_Model,
                    attributes: ['Status'] // Include only the Status attribute from Status_Model
                }
            ]
        });

        if (OrderDetails) {
            res.status(200).json({ OrderDetails });
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Update an Order (Admin)
router.put('/Orders/:id', async (req, res) => {
    try {
  
        const order = await Orders_Model.findOne({
        where: {
            OrderID: req.params.id
        },
        });
        
        if (order) {
        const updatedFields = {};
        const tableFields = ['StatusID', 'CityID', 'StateID', 'ZipCode', 'Address', 'Total', 'DateScheduled','DateDelivered'];

        tableFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'DateScheduled' || field === 'DateDelivered') {
                    // Use Moment.js to format the date correctly
                    updatedFields[field] = moment(req.body[field], 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');
                } else {
                    updatedFields[field] = req.body[field];
                }
            }
        });

        Orders_Model.update(updatedFields,{
            where: {
            OrderID: order.OrderID
            },
        });

        res.status(200).json({ message: 'Order Updated' });

    }} catch (err) {
        console.log(err)
    }
  });

//Delete an Order
router.delete('/Orders/:id', async (req, res) => {
    try {
  
        const order = await Orders_Model.findOne({
        where: {
            OrderID: req.params.id,
        },
        });
        
        if (order) {
        Orders_Model.destroy(
            {
            where: {
            OrderID: order.OrderID
            },
        });

        res.status(200).json({ message: 'Order Deleted' });

    }} catch (err) {
        console.log(err)
    }
  });


//Get All Custom Orders
router.get('/CustomOrders', async (req, res) => {
    try {
        const CustomOrders = await Custom_Orders_Model.findAll({
            include: [
                {
                    model: State_Model,
                    attributes: ['State'] // Include only the State attribute from State_Model
                },
                {
                    model: City_Model,
                    attributes: ['City'] // Include only the City attribute from City_Model
                },
                {
                    model: Status_Model,
                    attributes: ['Status'] // Include only the Status attribute from Status_Model
                },
                ///Jesus Admin Custom Order Chats
                {
                    model: Customers_Model,
                    attributes: ['CustomerFirstName', 'CustomerLastName']
                }
            ]
        });

        if (CustomOrders && CustomOrders.length > 0) {
            res.status(200).json({ CustomOrders });
        } else {
            res.status(401).json({ message: 'No Custom Orders' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Get Custom Order Details
router.get('/CustomOrders/:id', async (req, res) => {
    try {
        const OrderDetails = await Custom_Orders_Model.findOne({
            where: {
                CustomOrderID: req.params.id
            },
            include: [
                {
                    model: State_Model,
                    attributes: ['State'] // Include only the State attribute from State_Model
                },
                {
                    model: City_Model,
                    attributes: ['City'] // Include only the City attribute from City_Model
                },
/*                 {
                    model: Status_Model,
                    attributes: ['Status'] // Include only the Status attribute from Status_Model
                } */
            ]
        });

        if (OrderDetails) {
            res.status(200).json({ OrderDetails });
        } else {
            res.status(404).json({ message: 'Custom order not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Update a Custom Order (Admin)
router.put('/CustomOrders/:id', async (req, res) => {
    try {
        const customorder = await Custom_Orders_Model.findOne({
            where: {
                CustomOrderID: req.params.id
            },
        });

        if (customorder) {
            const updatedFields = {};
            const tableFields = ['StatusID', 'CityID', 'StateID', 'ZipCode', 'Address', 'Total', 'DateScheduled', 'DateDelivered'];

            tableFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    if (field === 'DateScheduled' || field === 'DateDelivered') {
                        // Use Moment.js to format the date correctly
                        updatedFields[field] = moment(req.body[field], 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');
                    } else {
                        updatedFields[field] = req.body[field];
                    }
                }
            });

            await Custom_Orders_Model.update(updatedFields, {
                where: {
                    CustomOrderID: customorder.CustomOrderID
                },
            });

            res.status(200).json({ message: 'Custom Order Updated' });
        } else {
            res.status(404).json({ message: 'Custom Order not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Delete a Custom Order
router.delete('/CustomOrders/:id', async (req, res) => {
    try {
  
        const customorder = await Custom_Orders_Model.findOne({
        where: {
            CustomOrderID: req.params.id,
        },
        });
        
        if (customorder) {
        Custom_Orders_Model.destroy(
            {
            where: {
            CustomOrderID: customorder.CustomOrderID
            },
        });

        res.status(200).json({ message: 'Custom Order Deleted' });

    }} catch (err) {
        console.log(err)
    }
  });


//Get All Feedback
router.get('/Feedback', (req, res) =>
    Feedback_Model.findAll()
    .then(Feedback => {
        res.json(Feedback);
    })
    .catch(err => console.log(err)));

//Get Feedback Details
router.get('/Feedback/:id', async (req, res) => {
    try {
  
        const FeedbackDetails = await Feedback_Model.findOne({
        where: {
            FeedbackID: req.params.id,
        },
        });

        res.status(200).json({ FeedbackDetails });

    } catch (err) {
        console.log(err)
    }
  });

//Delete Feedback
router.delete('/Feedback/:id', async (req, res) => {
    try {
  
        const feedback = await Feedback_Model.findOne({
        where: {
            FeedbackID: req.params.id,
        },
        });
        
        if (feedback) {
        Feedback_Model.destroy(
            {
            where: {
            FeedbackID: feedback.FeedbackID
            },
        });

        res.status(200).json({ message: 'Feedback Deleted' });

    }} catch (err) {
        console.log(err)
    }
  });


//Add Status
router.post('/Status', async (req, res) => {
    try {
        //Adds a new Status
        Status_Model.create(
            {
            Status: req.body.Status
            })

        res.status(200).json({ message: 'Status Added' });
    } catch(err) {
        console.log(err)
    }
});

//Add City
router.post('/City', async (req, res) => {
    try {
        //Adds a new Status
        City_Model.create(
            {
            City: req.body.City,
            StateID: req.body.StateID
            })

        res.status(200).json({ message: 'City Added' });
    } catch(err) {
        console.log(err)
    }
});

//Add State
router.post('/State', async (req, res) => {
    try {
        //Adds a new Status
        State_Model.create(
            {
            State: req.body.State,
            })

        res.status(200).json({ message: 'State Added' });
    } catch(err) {
        console.log(err)
    }
});

router.post('/AdminSignUp', async (req, res) => {

    try {
  
      const hashedPassword = await bcrypt.hash(req.body.Password, 10)

      const admin = await Admins_Model.create(
        {
        AdminLastName: req.body.AdminLastName,
        AdminFirstName: req.body.AdminFirstName,
        AdminAddress: req.body.AdminAddress,
        AdminPhone: req.body.AdminPhone,
        AdminEmail: req.body.AdminEmail
        });
  
      // Create username for the customer
      const usernames = await Usernames_Model.create({
        AdminID: admin.AdminID,
        Username: req.body.Username
      });
  
      // Create password for the customer (hashed)
      await Passwords_Model.create({
        AdminID: admin.AdminID,
        Password: hashedPassword
      });
  
      // Generate JWT token for the newly registered user
      const token = jwt.sign({ userId: admin.AdminID, username: usernames.Username }, secret_key, { expiresIn: '1h' });
  
      // Send response with token and success message
      res.status(201).json({ message: 'SignUp successful', token: token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

//Get Custom Product Details
router.get('/CustomProducts/:id', async (req, res) => {
    try {
  
        const ProductDetails = await Custom_Products_Model.findOne({
        where: {
            CustomProductID: req.params.id,
        },
        });

        res.status(200).json({ ProductDetails });

    } catch (err) {
        console.log(err)
    }
  });

// Add Custom Product to a Custom Order
router.post('/CustomOrders/:id/products', async (req, res) => {
    const CustomProductID = req.body.CustomProductID;
    const Quantity = req.body.Quantity
    const CustomOrderID = req.params.id;

    try {
        // Check if the order and product exist
        const order = await Custom_Orders_Model.findOne({ where: { CustomOrderID: CustomOrderID } });
        const product = await Custom_Products_Model.findOne({ where: { CustomProductID: CustomProductID } });

        if (!order || !product) {
            return res.status(404).json({ message: 'Order or product not found' });
        }

                //get Updated Total for the Order
                const updatedTotal = parseInt(order.Total) + (parseFloat(product.CustomProductPrice) * parseInt(Quantity))

                //Update the total price for the order
                await Custom_Orders_Model.update(
                    {
                        Total: updatedTotal,
                    },{
                        where: {
                        CustomOrderID: order.CustomOrderID
                        },
                    });

        // Create an entry in Order_Products_Model to associate the product with the order
        await Custom_Products_Order_Model.create({
            CustomProductID: CustomProductID,
            CustomOrderID: CustomOrderID,
            Quantity: Quantity
        });

        res.status(201).json({ message: 'Product added to order successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove a Custom Product from a Custom Order
router.delete('/CustomOrders/:id/products', async (req, res) => {
    const CustomProductID = req.body.CustomProductID;
    const CustomOrderID = req.params.id;

    try {
        // Check if the order and product exist
        const order = await Custom_Orders_Model.findOne({ where: { CustomOrderID: CustomOrderID } });
        const product = await Custom_Products_Model.findOne({ where: { CustomProductID: CustomProductID } });

        if (!order || !product) {
            return res.status(404).json({ message: 'Order or product not found' });
        }

        // Get the quantity of the product in the order
        const orderProduct = await Custom_Products_Order_Model.findOne({
            where: {
                CustomOrderID: CustomOrderID,
                CustomProductID: CustomProductID
            }
        });

        if (!orderProduct) {
            return res.status(404).json({ message: 'Product not found in the order' });
        }

        const productQuantity = orderProduct.Quantity;

        // Calculate the reduction in total
        const reduction = parseFloat(product.ProductPrice) * parseInt(productQuantity);

        // Subtract the reduction from the order total
        const updatedTotal = parseFloat(order.Total) - reduction;

        // Update the total price for the order
        await Custom_Orders_Model.update(
            {
                Total: updatedTotal,
            },
            {
                where: {
                    CustomOrderID: order.CustomOrderID
                },
            }
        );

       // Remove an entry in Order_Custom_Products_Model that associates the product with the order
        await Custom_Products_Order_Model.destroy({
            where: {
                CustomOrderID: CustomOrderID,
                CustomProductID: CustomProductID
            }
        });

        res.status(201).json({ message: 'Custom Product removed from order successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


//GET all Custom Products
router.get('/CustomProducts', (req, res) =>
    Custom_Products_Model.findAll()
    .then(products => {
        res.json(products);
    })
    .catch(err => console.log(err)));


//Add a Custom Product
router.post('/CustomProducts', upload.single('DesignImage'), async (req, res) => {
    // Set up the S3 client
    const s3 = new S3Client({
        region: process.env.BUCKET_REGION,
        credentials: fromEnv(),
    });

    try {
        const { ChatID, CustomProductName, CustomProductType, CustomProductColor, CustomProductSize, CustomProductPrice, CustomProductStock } = req.body;

        // Check if the DesignImage is undefined
        if (!req.file) {
            return res.status(400).json({ message: 'No image provided' });
        }

        console.log('Uploaded File:', req.file); // Log the uploaded file to debug

        // Read the file from the local file system
        const fileContent = fs.readFileSync(req.file.path);

        // Prepare the S3 upload parameters
        const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: req.file.filename, // You might want to add a file extension based on the mimetype
            Body: fileContent,
            ContentType: req.file.mimetype,
        };

        // Upload the file to S3
        const uploadResult = await s3.send(new PutObjectCommand(params));
        if (uploadResult.$metadata.httpStatusCode === 200) {
            // The image was uploaded successfully
            const imageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${req.file.filename}`;

            // Create the custom product with the S3 image URL
            const newCustomProduct = await Custom_Products_Model.create({
                ChatID,
                CustomProductName,
                CustomProductType,
                CustomProductColor,
                CustomProductSize,
                CustomProductPrice,
                CustomProductStock,
                DesignImage: imageUrl,
            });

            res.status(200).json({ message: 'Custom Product Added', customProduct: newCustomProduct });

            // Delete the local file after uploading to S3
            fs.unlinkSync(req.file.path);
        } else {
            throw new Error('Failed to upload image to S3');
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to add custom product', error: err.message });
        // Delete the local file if there was an error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
    }
});

//Update a Custom Product
router.put('/CustomProducts/:id', async (req, res) => {
    try {
  
        const product = await Custom_Products_Model.findOne({
        where: {
            CustomProductID: req.params.id,
        },
        });
        
        if (product) {
        const updatedFields = {};
        const tableFields = ['CustomProductName', 'CustomProductType', 'CustomProductColor', 'CustomProductSize', 'CustomProductPrice', 'CustomProductStock', 'DesignImage'];

        tableFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updatedFields[field] = req.body[field];
            }
        });

        Custom_Products_Model.update(updatedFields,{
            where: {
            CustomProductID: product.CustomProductID
            },
        });

        res.status(200).json({ message: 'Product Updated' });

    }} catch (err) {
        console.log(err)
    }
  });

//Delete a Custom Product
router.delete('/CustomProducts/:id', async (req, res) => {
    try {
  
        const product = await Custom_Products_Model.findOne({
        where: {
            CustomProductID: req.params.id,
        },
        });
        
        if (product) {
        Custom_Products_Model.destroy(
            {
            where: {
            CustomProductID: product.CustomProductID,
            CustomProductName: req.body.CustomProductName,
            },
        });

        res.status(200).json({ message: 'Product Deleted' });

    }} catch (err) {
        console.log(err)
    }
  });

//Get orders and custom orders between date range
router.get('/Reports/Between-Dates/', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        

        // Validate the presence of startDate and endDate parameters
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required.' });
        }

        // Set time components to match the database format
        const parsedStartDate = moment(startDate, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');
        const parsedEndDate = moment(endDate, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');

        // Retrieve orders within the specified date range
        const orders = await Orders_Model.findAll({
            where: {
                DateScheduled: {
                    [Sequelize.Op.and]: {
                        [Sequelize.Op.gte]: parsedStartDate,
                        [Sequelize.Op.lte]: parsedEndDate,
                    }
                }
            },
            include: [
                { model: City_Model },
                { model: State_Model },
                { model: Status_Model }
            ]
        });

        // Retrieve custom orders within the specified date range
        const customOrders = await Custom_Orders_Model.findAll({
            where: {
                DateScheduled: {
                    [Sequelize.Op.and]: {
                        [Sequelize.Op.gte]: parsedStartDate,
                        [Sequelize.Op.lte]: parsedEndDate,
                    }
                }
            },
            include: [
                { model: City_Model },
                { model: State_Model },
                //{ model: Status_Model }
            ]
        });

        if (!orders.length && !customOrders.length) {
            return res.status(404).json({ error: 'No orders or custom orders found within the specified date range.' });
        }

        res.status(200).json({ orders, customOrders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Gets the Total amount of money made during the time frame
router.get('/Reports/Between-Dates/Total', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Format the start and end dates to match the database format
        const parsedStartDate = moment(startDate, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');
        const parsedEndDate = moment(endDate, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');

        const orders = await Orders_Model.findAll({
            where: {
                DateOrdered: {
                    [Sequelize.Op.and]: {
                        [Sequelize.Op.gte]: parsedStartDate,
                        [Sequelize.Op.lte]: parsedEndDate,
                    }
                }
            },
        });

        const customOrders = await Custom_Orders_Model.findAll({
            where: {
                DateOrdered: {
                    [Sequelize.Op.and]: {
                        [Sequelize.Op.gte]: parsedStartDate,
                        [Sequelize.Op.lte]: parsedEndDate,
                    }
                }
            },
        });

        // Calculate total amount made from orders
        const ordersTotal = orders.reduce((total, order) => total + order.Total, 0);

        // Calculate total amount made from custom orders
        const customOrdersTotal = customOrders.reduce((total, customOrder) => total + customOrder.Total, 0);

        // Calculate overall total amount made
        const totalAmountMade = ordersTotal + customOrdersTotal;

        res.json({
            orders: orders,
            customOrders: customOrders,
            totalAmountMade: totalAmountMade,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

//Gets the Top Selling Products during the entered date range
router.get('/Reports/Top-Selling-Products', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const parsedStartDate = moment(startDate, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');
        const parsedEndDate = moment(endDate, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');

        // Validate the presence of startDate and endDate parameters
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required.' });
        }

        // Retrieve top-selling products within the specified date range
        const topSellingProducts = await Order_Products_Model.findAll({
             /* where: {
                createdAt: {
                    [Sequelize.Op.and]: {
                        [Sequelize.Op.gte]: parsedStartDate,
                        [Sequelize.Op.lte]: parsedEndDate,
                    }
                }
            }, */
            attributes: ['ProductID', [Sequelize.fn('sum', Sequelize.col('Quantity')), 'totalQuantity']],
            group: ['ProductID'],
            order: [[Sequelize.literal('totalQuantity'), 'DESC']],
            limit: 10, // Get top 10 products
            include: [
                {
                    model: Products_Model,
                    attributes: ['ProductName'],
                },
            ],
        });

        res.status(200).json({ topSellingProducts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Gets all of the Unapproved Custom Orders
router.get('/Reports/Unapproved-Custom-Orders', async (req, res) => {
    try {
        // Retrieve unapproved custom orders
        const unapprovedCustomOrders = await Custom_Orders_Model.findAll({
            where: {
                StatusID: {
                    [Sequelize.Op.not]: [2], // Assuming APPROVED_STATUS_ID is the ID for the approved status
                },
            },
            include: [
                { model: City_Model },
                { model: State_Model },
                { model: Status_Model },
                { model: Customers_Model },
            ],
        });

        res.status(200).json({ unapprovedCustomOrders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Gets all of the Unapproved Orders
router.get('/Reports/Unapproved-Orders', async (req, res) => {
    try {
        // Retrieve unapproved  orders
        const unapprovedOrders = await Orders_Model.findAll({
            where: {
                StatusID: {
                    [Sequelize.Op.not]: [2], // Assuming APPROVED_STATUS_ID is the ID for the approved status
                },
            },
            include: [
                { model: City_Model },
                { model: State_Model },
                { model: Status_Model },
                { model: Customers_Model },
            ],
        });

        res.status(200).json({ unapprovedOrders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Gets all of the Orders and Custom Orders that are Late for Delivery
router.get('/Reports/Late-Deliveries', async (req, res) => {
    try {
        // Get the current date and time
        const currentDate = new Date();

        // Retrieve late custom orders
        const lateCustomOrders = await Custom_Orders_Model.findAll({
            where: {
                DateScheduled: {
                    [Sequelize.Op.lt]: currentDate,
                },
            },
            include: [
                { model: City_Model },
                { model: State_Model },
                { model: Status_Model },
                { model: Customers_Model },
            ],
        });

        // Retrieve late regular orders
        const lateRegularOrders = await Orders_Model.findAll({
            where: {
                DateScheduled: {
                    [Sequelize.Op.lt]: currentDate,
                },
            },
            include: [
                { model: City_Model },
                { model: State_Model },
                { model: Status_Model },
                { model: Customers_Model },
            ],
        });

        res.status(200).json({ lateCustomOrders, lateRegularOrders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Gets the Total sales by each product type
router.get('/Reports/TotalSalesByType', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validate the presence of startDate and endDate parameters
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required.' });
        }

        // Retrieve total sales of products by type within the specified date range
        const totalSalesByType = await Order_Products_Model.findAll({
            /* where: {
                createdAt: {
                    [Sequelize.Op.between]: [startDate, endDate],
                },
            }, */
            include: [
                {
                    model: Products_Model,
                    attributes: ['ProductType'], // Select the ProductType column for grouping
                },
            ],
            attributes: [
                [Sequelize.fn('sum', Sequelize.col('ProductPrice')), 'totalSales'], // Calculate total sales
            ],
            group: ['ProductType'], // Group by ProductType
        });

        res.status(200).json(totalSalesByType);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Top Paying Customer
router.get('/Reports/TopPayingCustomers', async (req, res) => {
    try {
        const topPayingCustomers = await Customers_Model.findAll({
            attributes: [
                'CustomerID',
                'CustomerFirstName',
                'CustomerLastName',
                'CustomerEmail',
                'CustomerPhone',
                [
                    Sequelize.literal('COALESCE((SELECT SUM(ORDERS.Total) FROM ORDERS WHERE ORDERS.CustomerID = CUSTOMERS.CustomerID AND ORDERS.DateDelivered IS NOT NULL), 0)'),
                    'totalOrderSpending'
                ],
                [
                    Sequelize.literal('COALESCE((SELECT SUM(CUSTOM_ORDERS.Total) FROM CUSTOM_ORDERS WHERE CUSTOM_ORDERS.CustomerID = CUSTOMERS.CustomerID AND CUSTOM_ORDERS.DateDelivered IS NOT NULL), 0)'),
                    'totalCustomOrderSpending'
                ],
            ],
            order: [
                Sequelize.literal('COALESCE(totalOrderSpending, 0) + COALESCE(totalCustomOrderSpending, 0) DESC')
            ],
            having: Sequelize.literal('COALESCE(totalOrderSpending, 0) + COALESCE(totalCustomOrderSpending, 0) > 0'),
            limit: 10
        });

        if (!topPayingCustomers || topPayingCustomers.length === 0) {
            return res.status(404).json({ error: 'No top paying customers found.' });
        }

        res.status(200).json(topPayingCustomers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//GET all Status
router.get('/Status', (req, res) =>
    Status_Model.findAll()
    .then(status => {
        res.json(status);
    })
    .catch(err => console.log(err)));

module.exports = router;
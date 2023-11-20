const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt')
const Sequelize = require('sequelize')
const moment = require('moment');

let {Products_Model} = require('../models/modelAssociations')
let {Orders_Model} = require('../models/modelAssociations')
let {Custom_Orders_Model} = require('../models/modelAssociations')
let {Feedback_Model} = require('../models/modelAssociations')
let {Usernames_Model} = require('../models/modelAssociations');
let {Passwords_Model} = require('../models/modelAssociations');
let {Customers_Model} = require('../models/modelAssociations');
let { Customer_Chat_Model } = require('../models/modelAssociations');
let { Custom_Products_Order_Model } = require('../models/modelAssociations');
let { Custom_Products_Model } = require('../models/modelAssociations');
let { Order_Products_Model } = require('../models/modelAssociations');
let { City_Model } = require('../models/modelAssociations');
let { State_Model } = require('../models/modelAssociations');
let { Status_Model } = require('../models/modelAssociations');
const { validateToken, resetPasswordLimiter } = require('../src/auth/JWT')
//GET all Products
router.get('/Products', (req, res) =>
    Products_Model.findAll()
    .then(products => {
        res.json(products);
    })
    .catch(err => console.log(err)));


//Maybe use params for all of the CustomerID stuff since it should have one if they are logged in?
//Update a Customer's Information
router.put('/AccountInfo', validateToken, async (req, res) => {
    const { userId, username, role } = req.user
    try {
        const customer = await Customers_Model.findOne({
            where: {
                CustomerID: userId,
            },
        });

        if (customer) {
            // Extract only the fields that are present in req.body
            const updatedFields = {};
            const tableFields = ['CityID', 'StateID', 'ZipCode', 'CustomerLastName', 'CustomerFirstName', 'CustomerAddress', 'CustomerPhone', 'CustomerEmail'];

            // Fetch CityID and StateID based on the provided city and state names
            const city = await City_Model.findOne({
                where: {
                    City: req.body.City,
                },
            });

            const state = await State_Model.findOne({
                where: {
                    State: req.body.State,
                },
            });

            // If city and state are found, update the corresponding IDs
            if (city && state) {
                updatedFields.CityID = city.CityID;
                updatedFields.StateID = state.StateID;
            }

            tableFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updatedFields[field] = req.body[field];
                }
            });

            // Update only the fields present in updateFields object
            await Customers_Model.update(updatedFields, {
                where: {
                    CustomerID: customer.CustomerID,
                },
            });

            res.status(200).json({ message: 'Information Updated' });
        } else {
            res.status(404).json({ message: 'Customer not found' });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

//Get Customer Info
router.get('/AccountInfo/', validateToken, async (req, res) => {
    const { userId, username, role } = req.user
    try {
        const customerId = userId

        const customer = await Customers_Model.findOne({
            where: {
                CustomerID: customerId,
            },
            attributes: ['CustomerID', 'CityID', 'StateID', 'ZipCode', 'CustomerLastName', 'CustomerFirstName', 'CustomerAddress', 'CustomerPhone', 'CustomerEmail'],
            include: [
                {
                    model: City_Model,
                    attributes: ['CityID', 'City'],
                },
                {
                    model: State_Model,
                    attributes: ['StateID', 'State'],
                },
            ],
        });

        if (customer) {
            res.status(200).json({ customer });
        } else {
            res.status(404).json({ message: 'Customer not found' });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


//Update a Customer's Username
router.put('/ChangeUsername', async (req, res) => {
    try {
  
        const customer = await Customers_Model.findOne({
        where: {
            CustomerEmail: req.body.CustomerEmail,
        },
        });

        if (customer) {
        Usernames_Model.update(
            {
            Username: req.body.Username
        },{
            where: {
            CustomerID: customer.CustomerID
            },
        });

        res.status(200).json({ message: 'Username Changed' });

    }} catch (err) {
        console.log(err)
    }
  });

// Update a Customer's Password
router.put('/ChangePassword', resetPasswordLimiter, async (req, res) => {
    try {

        // Hash the new password before updating
        const hashedPassword = await bcrypt.hash(req.body.Password, 10);

        const customer = await Customers_Model.findOne({
            where: {
                CustomerEmail: req.body.CustomerEmail,
            },
        });
        if (customer) {
            // Update the password with the hashed value
            await Passwords_Model.update(
                {
                    Password: hashedPassword,
                },
                {
                    where: {
                        CustomerID: customer.CustomerID,
                    },
                }
            );

            res.status(200).json({ message: 'Password Changed' });
        } else {
            res.status(404).json({ message: 'Customer not found' });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


//Get All Orders a customer has
router.get('/Orders', validateToken, async (req, res) => {
    const { userId, username, role } = req.user
    try {
        //First searches for a Username what matches with the username provided
        const customer = await Usernames_Model.findOne({
        where: {
            Username: username,
        },
        });

        //If the customer exists
        if (customer) {
        const Customer_Orders = await Orders_Model.findAll({
            where: {
            CustomerID: customer.CustomerID
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

        //If there is a match 
        if (Customer_Orders && Customer_Orders.length > 0) {
            res.status(200).json({ Customer_Orders });
        } else {
            res.status(401).json({ message: 'No Orders' });
        }
        } else {
        // Username not found
        res.status(404).json({ message: 'Username not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
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

// Add Product to Order
router.post('/Orders/:id/products', async (req, res) => {
    const ProductID = req.body.ProductID;
    const Quantity = req.body.Quantity
    const orderID = req.params.id;

    try {
        // Check if the order and product exist
        const order = await Orders_Model.findOne({ where: { OrderID: orderID } });
        const product = await Products_Model.findOne({ where: { ProductID: ProductID } });

        if (!order || !product) {
            return res.status(404).json({ message: 'Order or product not found' });
        }

        // Check if there is enough stock for the product
        if (parseInt(product.Stock) < parseInt(Quantity)) {
            return res.status(400).json({ message: 'Insufficient stock' });
        }

        //get Updated Total for the Order
        const updatedTotal = parseInt(order.Total) + (parseFloat(product.ProductPrice) * parseInt(Quantity))

        //Update the total price for the order
        await Orders_Model.update(
            {
                Total: updatedTotal,
            },{
                where: {
                OrderID: order.OrderID
                },
            });

        // Create an entry in Order_Products_Model to associate the product with the order
        await Order_Products_Model.create({
            OrderID: orderID,
            ProductID: ProductID,
            Quantity: parseInt(Quantity)
        });

        // Subtract ordered quantity from product stock
        const updatedStock = parseInt(product.ProductStock) - parseInt(Quantity);
        await Products_Model.update(
            {
                ProductStock: updatedStock,
            },
            {
                where: {
                    ProductID: ProductID
                },
            }
        );

        res.status(201).json({ message: 'Product added to order successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove a Product from an Order
router.delete('/Orders/:id/products', async (req, res) => {
    const ProductID = req.body.ProductID;
    const orderID = req.params.id;

    try {
        // Check if the order and product exist
        const order = await Orders_Model.findOne({ where: { OrderID: orderID } });
        const product = await Products_Model.findOne({ where: { ProductID: ProductID } });

        if (!order || !product) {
            return res.status(404).json({ message: 'Order or product not found' });
        }

        // Get the quantity of the product in the order
        const orderProduct = await Order_Products_Model.findOne({
            where: {
                OrderID: orderID,
                ProductID: ProductID
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
        await Orders_Model.update(
            {
                Total: updatedTotal,
            },
            {
                where: {
                    OrderID: order.OrderID
                },
            }
        );

        // Remove an entry in Order_Products_Model that associates the product with the order
        await Order_Products_Model.destroy({
            where: {
                OrderID: orderID,
                ProductID: ProductID
            }
        });

        res.status(201).json({ message: 'Product removed from order successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Associated Products by OrderID
router.get('/Orders/:id/products', async (req, res) => {
    const OrderID = req.params.id;

    try {
        // Find all products associated with the given OrderID
        const products = await Order_Products_Model.findAll({
            where: {
                OrderID: OrderID
            },
            include: [
                {
                    model: Products_Model
                }
            ],
            attributes: ['Quantity']
        });

        if (products.length > 0) {
            // Extract the products and Quantity from the result and send the response
            const extractedProducts = products.map(item => {
                return {
                    ...item.PRODUCT.dataValues,
                    Quantity: item.Quantity // Include the Quantity field in the response object
                };
            });
            res.status(200).json({ products: extractedProducts });
        } else {
            res.status(404).json({ message: 'No products found for the given OrderID' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


//Update an Order (Customer)
router.put('/Orders/:id', async (req, res) => {
    try {
  
        const order = await Orders_Model.findOne({
        where: {
            OrderID: req.params.id
        },
        });
        
        if (order) {
        Orders_Model.update(
            {
            CityID: req.body.CityID,
            StateID: req.body.StateID,
            ZipCode: req.body.ZipCode,
            Address: req.body.Address
        },{
            where: {
            OrderID: order.OrderID
            },
        });

        res.status(200).json({ message: 'Order Updated' });

    }} catch (err) {
        console.log(err)
    }
  });

//Add an Order
router.post('/Orders', async (req, res) => {
    try {


        const parsedDateScheduled = moment(req.body.DateScheduled, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');

        const customer = await Usernames_Model.findOne({
            where: {
                Username: req.body.Username,
            },
        });

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

        //Adds a new Order
        const newOrder = await Orders_Model.create(
            {
            CustomerID: customer.CustomerID,
            StatusID: req.body.StatusID,
            CityID: city.CityID,
            StateID: state.StateID,
            ZipCode: req.body.ZipCode,
            Address: req.body.Address,
            Total: "0",
            DateScheduled: parsedDateScheduled
            })

        OrderID = newOrder.OrderID

        res.status(200).json({ message: 'Order Added', OrderID });
    } catch(err) {
        console.log(err)
        res.status(401).json({ error: 'User not authenticated' });
    }
});

//Get All Custom Orders a customer has
router.get('/CustomOrders', validateToken, async (req, res) => {
    const { userId, username, role } = req.user
    try {
        //First searches for a Username what matches with the username provided
        const customer = await Usernames_Model.findOne({
        where: {
            Username: username,
        },
        });
        
        //If the customer exists
        if (customer) {
        const Customer_Orders = await Custom_Orders_Model.findAll({
            where: {
            CustomerID: customer.CustomerID
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

        //If there is a match 
        if (Customer_Orders) {
            res.status(200).json({ Customer_Orders });
        } else {
            res.status(401).json({ message: 'No Custom Orders' });
        }
        } else {
        // Username not found
        res.status(404).json({ message: 'Username not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
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
                {
                    model: Status_Model,
                    attributes: ['Status'] // Include only the Status attribute from Status_Model
                } 
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

//Update an Order (Customer)
router.put('/CustomOrders/:id', async (req, res) => {
    try {
  
        const customorder = await Custom_Orders_Model.findOne({
        where: {
            CustomOrderID: req.params.id
        },
        });
        
        if (customorder) {
        Custom_Orders_Model.update(
            {
            CityID: req.body.CityID,
            StateID: req.body.StateID,
            ZipCode: req.body.ZipCode,
            Address: req.body.Address
        },{
            where: {
            CustomOrderID: customorder.CustomOrderID
            },
        });

        res.status(200).json({ message: 'Custom Order Updated' });

    }} catch (err) {
        console.log(err)
    }
  });

//Add a Custom Order
router.post('/CustomOrders', async (req, res) => {
    try {
        const parsedDateScheduled = moment(req.body.DateScheduled, 'MM/DD/YYYY').format('YYYY-MM-DD HH:mm:ss');

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

        const customer = await Usernames_Model.findOne({
            where: {
                Username: req.body.Username,
            },
        });

        // Adds a new Custom Order
        const customOrder = await Custom_Orders_Model.create({
            CustomerID: customer.CustomerID,
            StatusID: req.body.StatusID,
            CityID: city.CityID,
            StateID: state.StateID,
            ZipCode: req.body.ZipCode,
            Address: req.body.Address,
            Total: "0",
            DateScheduled: parsedDateScheduled,
        });

        res.status(200).json({ message: 'Custom Order Added', customOrder });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Get Associated Custom Products by OrderID
router.get('/CustomOrders/:id/products', async (req, res) => {
    const CustomOrderID = req.params.id;

    try {
        // Find all products associated with the given OrderID
        const products = await Custom_Products_Order_Model.findAll({
            where: {
                CustomOrderID: CustomOrderID
            },
            include: [
                {
                    model: Custom_Products_Model
                }
            ],
        attributes: ['Quantity']
        });

        if (products.length > 0) {
            // Extract the products and Quantity from the result and send the response
            const extractedProducts = products.map(item => {
                return {
                    ...item.CUSTOM_PRODUCT.dataValues,
                    Quantity: item.Quantity // Include the Quantity field in the response object
                };
            });
            res.status(200).json({ products: extractedProducts });
        } else {
            res.status(404).json({ message: 'No products found for the given OrderID' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Add Feedback
router.post('/Feedback', async (req, res) => {
    try {
      const customer = await Usernames_Model.findOne({
        where: {
          Username: req.body.Username,
        },
      });
  
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
  
      //Adds Feedback
      Feedback_Model.create({
        OrderID: req.body.OrderID,
        CustomerID: customer.CustomerID,
        Feedback: req.body.Feedback,
        Rating: req.body.Rating,
      });
  
      res.status(201).json({ message: 'Feedback Added' });
    } catch (err) {
      console.log(err);
    }
  });

router.get('/Feedback/:OrderID', async (req, res) => {
    try {
  
        const FeedbackDetails = await Feedback_Model.findOne({
        where: {
            OrderID: req.params.OrderID,
        },
        });

        res.status(200).json({ FeedbackDetails });

    } catch (err) {
        console.log(err)
    }
  });

// Handle customer messages
router.post('/customer/message', async (req, res) => {
  
    try {
      // Save customer message to CustomerChat table
      const customerMessage = await Customer_Chat_Model.create({
        ChatID: req.body.ChatID,
        CustomerID: req.body.CustomerID,
        CustomerMessages: req.body.CustomerMessage,
      });

        const room = `chat_${ChatID}`;
        io.to(room).emit('customerMessage', { CustomerID, message });
  
      // Send success response
      res.status(201).json({ message: 'Customer message saved and broadcasted successfully' });
    } catch (error) {
      // Handle errors
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

module.exports = router;
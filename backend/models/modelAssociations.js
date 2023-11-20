//Some of our tables have a circular dependancy. This file allows us to create the foreign keys after they were both initialized
//An example is the Usernames and Passwords table (They both reference each other)
//Documentaion for Associations: https://sequelize.org/docs/v6/core-concepts/assocs/

let Models = require('./models')

//Importing all of the Models
let Customers_Model = Models.Customers_Model
let Admins_Model = Models.Admins_Model
let Usernames_Model = Models.Usernames_Model
let Passwords_Model = Models.Passwords_Model
let City_Model = Models.City_Model
let State_Model = Models.State_Model
let Status_Model = Models.Status_Model
let Customer_Chat_Model = Models.Customer_Chat_Model
let Admin_Chat_Model = Models.Admin_Chat_Model
let Chat_Model = Models.Chat_Model
let Orders_Model = Models.Orders_Model
let Custom_Orders_Model = Models.Custom_Orders_Model
let Combo_Orders_Model = Models.Combo_Orders_Model
let Products_Model = Models.Products_Model
let Order_Products_Model = Models.Order_Products_Model
let Custom_Products_Model = Models.Custom_Products_Model
let Custom_Products_Order_Model = Models.Custom_Products_Order_Model
let Feedback_Model = Models.Feedback_Model
let Reports_Model = Models.Reports_Model

//---------------------------------------------------//
//            State/City Relationship                //
//---------------------------------------------------//

State_Model.hasMany(City_Model, {foreignKey: 'StateID'})
City_Model.belongsTo(State_Model, {foreignKey: 'StateID'})

State_Model.hasMany(Custom_Orders_Model, {foreignKey: 'StateID'})
Custom_Orders_Model.belongsTo(State_Model, {foreignKey: 'StateID'})

City_Model.hasMany(Custom_Orders_Model, {foreignKey: 'CityID'})
Custom_Orders_Model.belongsTo(City_Model, {foreignKey: 'CityID'})

State_Model.hasMany(Orders_Model, {foreignKey: 'StateID'})
Orders_Model.belongsTo(State_Model, {foreignKey: 'StateID'})

City_Model.hasMany(Orders_Model, {foreignKey: 'CityID'})
Orders_Model.belongsTo(City_Model, {foreignKey: 'CityID'})

//---------------------------------------------------//
//            Customers Relationship                 //
//---------------------------------------------------//

Customers_Model.hasMany(Feedback_Model, {foreignKey: 'CustomerID'})
Feedback_Model.belongsTo(Customers_Model, {foreignKey: 'CustomerID'})

Customers_Model.hasMany(Custom_Orders_Model, {foreignKey: 'CustomerID'})
Custom_Orders_Model.belongsTo(Customers_Model, {foreignKey: 'CustomerID'})

Customers_Model.hasMany(Orders_Model, {foreignKey: 'CustomerID'})
Orders_Model.belongsTo(Customers_Model, {foreignKey: 'CustomerID'})

Customers_Model.hasOne(Usernames_Model, {foreignKey: 'CustomerID'})
Usernames_Model.belongsTo(Customers_Model, {foreignKey: 'CustomerID'})

Customers_Model.hasOne(Passwords_Model, {foreignKey: 'CustomerID'})
Passwords_Model.belongsTo(Customers_Model, {foreignKey: 'CustomerID'})

Customers_Model.hasMany(Customer_Chat_Model, {foreignKey: 'CustomerID'})
Customer_Chat_Model.belongsTo(Customers_Model, {foreignKey: 'CustomerID'})

Customers_Model.belongsTo(State_Model, { foreignKey: 'StateID', targetKey: 'StateID' });
Customers_Model.belongsTo(City_Model, { foreignKey: 'CityID', targetKey: 'CityID' });


//---------------------------------------------------//
//            Admins Relationship                    //
//---------------------------------------------------//

Admins_Model.hasMany(Reports_Model, {foreignKey: 'AdminID'})
Reports_Model.belongsTo(Admins_Model, {foreignKey: 'AdminID'})

Admins_Model.hasOne(Usernames_Model, {foreignKey: 'AdminID'})
Usernames_Model.belongsTo(Admins_Model, {foreignKey: 'AdminID'})

Admins_Model.hasOne(Passwords_Model, {foreignKey: 'AdminID'})
Passwords_Model.belongsTo(Admins_Model, {foreignKey: 'AdminID'})

Admins_Model.hasMany(Admin_Chat_Model, {foreignKey: 'AdminID'})
Admin_Chat_Model.belongsTo(Admins_Model, {foreignKey: 'AdminID'})

//---------------------------------------------------//
//            Custom Orders Relationship             //
//---------------------------------------------------//

Custom_Orders_Model.hasMany(Custom_Products_Order_Model, {foreignKey: 'CustomOrderID', sourceKey: 'CustomOrderID'})
Custom_Products_Order_Model.belongsTo(Custom_Orders_Model, {foreignKey: 'CustomOrderID', targetKey: 'CustomOrderID'})

Custom_Orders_Model.hasOne(Chat_Model, {foreignKey: 'CustomOrderID'})

//---------------------------------------------------//
//            Custom Products Relationship           //
//---------------------------------------------------//

Custom_Products_Model.hasMany(Custom_Products_Order_Model, {foreignKey: 'CustomProductID', sourceKey: 'CustomProductID'})
Custom_Products_Order_Model.belongsTo(Custom_Products_Model, {foreignKey: 'CustomProductID', targetKey: 'CustomProductID'})

//---------------------------------------------------//
//            Orders Relationship                    //
//---------------------------------------------------//

Orders_Model.hasMany(Order_Products_Model, {foreignKey: 'OrderID'})
Order_Products_Model.belongsTo(Orders_Model, {foreignKey: 'OrderID'})

//---------------------------------------------------//
//            Products Relationship                  //
//---------------------------------------------------//

Products_Model.hasMany(Order_Products_Model, {foreignKey: 'ProductID'})
Order_Products_Model.belongsTo(Products_Model, {foreignKey: 'ProductID'})

//---------------------------------------------------//
//            Chat Relationship                      //
//---------------------------------------------------//

Chat_Model.hasMany(Customer_Chat_Model, {foreignKey: 'ChatID'});

Chat_Model.hasMany(Admin_Chat_Model, {foreignKey: 'ChatID'});

Customer_Chat_Model.belongsTo(Chat_Model, {foreignKey: 'ChatID'});

Admin_Chat_Model.belongsTo(Chat_Model, {foreignKey: 'ChatID'});

//---------------------------------------------------//
//            Status Relationship                    //
//---------------------------------------------------//

Status_Model.hasMany(Custom_Orders_Model, {foreignKey: 'StatusID'})
Custom_Orders_Model.belongsTo(Status_Model, {foreignKey: 'StatusID'})

Status_Model.hasMany(Orders_Model, {foreignKey: 'StatusID'})
Orders_Model.belongsTo(Status_Model, {foreignKey: 'StatusID'})



//There is probably a better and cleaner way to do this....
module.exports = {
    Customers_Model,
    Admins_Model,
    Usernames_Model,
    Passwords_Model,
    City_Model,
    State_Model,
    Status_Model,
    Customer_Chat_Model,
    Admin_Chat_Model,
    Chat_Model,
    Orders_Model,
    Custom_Orders_Model,
    Combo_Orders_Model,
    Products_Model,
    Order_Products_Model,
    Custom_Products_Model,
    Custom_Products_Order_Model,
    Feedback_Model,
    Reports_Model
}

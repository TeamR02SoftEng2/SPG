'use strict';

const express = require('express');
const cron = require('node-cron'); // node-cron is for scheduling requests
const nodemailer = require('nodemailer'); // for sending an email
const bcrypt = require('bcryptjs');
const morgan = require('morgan'); // logging middleware
const clientsDao = require('./DAOs/clients-dao');
const ordersDao = require('./DAOs/client-orders-dao');
const productsDAO = require('./DAOs/products-dao');
const providersDAO = require('./DAOs/providers-dao');
const walletsDAO = require('./DAOs/wallet-dao');
const warehouseDao = require('./DAOs/warehouse-dao');
const deliverersDao = require('./DAOs/deliverers-dao.js');
const passportLocal = require('passport-local').Strategy; //Authentication strategy
const session = require('express-session'); //Session middleware
const passport = require('passport'); //Authentication middleware
const dbt = require('./DAOs/users-dao'); // module for accessing the DB

const fileUpload = require('express-fileupload'); //Middleware for storing files
const path = require('path');
const fs = require('fs');

// init express
let app = express();
require('dotenv').config();
app.disable('x-powered-by');
const PORT = 3001;

// set-up the middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(fileUpload());

app.setTestingMode = (test_db_name) => {
  clientsDao.setTestDB(test_db_name);
  ordersDao.setTestDB(test_db_name);
  productsDAO.setTestDB(test_db_name);
  providersDAO.setTestDB(test_db_name);
  walletsDAO.setTestDB(test_db_name);
  warehouseDao.setTestDB(test_db_name);
  dbt.setTestDB(test_db_name);
};

let transporter = nodemailer.createTransport({
  service: 'gmail',
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/api/sendEmail', function (req, res) {
  let mailOptions = {
    from: process.env.EMAIL_USER,
    to: `${req.body.email}`,
    subject: `Status of your Order`,
    text: `${req.body.message}`,
  };


  transporter.sendMail(mailOptions, function (err, data) {
    if (err) {
      res.json({
        status: 'fail',
      });
    } else {
      console.log('== Message Sent ==');
      res.json({
        status: 'success',
      });
    }
  });
});

app.post('/api/sendReminderForPickup', function (req, res) {

  let mailOptions = {
    from: process.env.EMAIL_USER,
    to: `${req.body.email}`,
    subject: `Status of your Order`,
    text: `${req.body.message}`,
  };


  transporter.sendMail(mailOptions, function (err, data) {
    if (err) {
      res.json({
        status: 'fail',
      });
    } else {
      console.log('== Message Sent ==');
      res.json({
        status: 'success',
      });
    }
  });
});


let strA = '55 22 15 13 12 *'

cron.schedule(strA, () => {
  console.log('running a task every minute');
});

/*** Set up Passport ***/
passport.use(
  new passportLocal.Strategy((username, password, done) => {
    dbt
      .getUser(username, password)
      .then((user) => {
        if (user) {
          //Authentication successful, db returned user
          done(null, user);
        } else {
          //Authentication failed (wrong credentials)
          done(null, false, { message: 'Wrong username and/or password' });
        }
      })
      .catch((err) => {
        done(err); //DB error
      });
  })
);

// serialize and de-serialize the user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  dbt
    .getUserById(id)
    .then((user) => {
      done(null, user); //make user available in req.user
    })
    .catch((err) => {
      done(err, null); //user authorization failed (user with that id not existing)
    });
});

const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();

  return res.status(401).json({ error: 'not authenticated' });
};

// set up the session
app.use(
  session({
    secret:
      'a secret sentence not to share with anybody and anywhere, used to sign the session ID cookie',
    resave: false,
    saveUninitialized: false,
  })
);

// then, init passport
app.use(passport.initialize());
app.use(passport.session());

/*** Users APIs ***/

// user login
app.post('/api/sessions', function (req, res, next) {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json(info);
    }
    req.login(user, (error) => {
      if (error) return next(error);
      return res.json(req.user);
    });
  })(req, res, next);
});

// GET currently logged user information
app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).json(req.user);
  } else res.status(401).json({ code: 401, error: 'Unauthenticated user!' });
});

// user logout
app.delete('/api/sessions/current', (req, res) => {
  req.logout();
  res.end('Logout completed!');
});

//GET all clients and budget
app.get('/api/clients', async (req, res) => {
  try {
    const o = await clientsDao.getAllClients();
    return res.status(200).json(o);
  } catch (err) {
    res.status(500).json({
      code: 500,
      error: `Database error during the retrieve of the list of clients.`,
    });
  }
});

//GET all client orders
app.get('/api/orders', async (req, res) => {
  try {
    const m = await ordersDao.getAllOrders();
    return res.status(200).json(m);
  } catch (err) {
    res.status(500).json({
      code: 500,
      error: 'Database error during the retrieve of the list of orders.',
    });
  }
});

// PUT update state
app.put('/api/modifyState', async (req, res) => {
  ordersDao
    .changeState(req.body.id, req.body.state)
    .then(() => {
      res.status(200).json();
      return res;
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json(error);
    });
});

// PUT update state
app.put('/api/modifyStateFarmer', async (req, res) => {
  warehouseDao
    .changeStateFarmer(req.body.id, req.body.product_name, req.body.state)
    .then(() => {
      res.status(200).json();
      return res;
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json(error);
    });
});

//PUT to update a product as delivered
app.put(
  '/api/orders/:order_id/:product_name',

  async (req, res) => {
    try {
      await ordersDao.delivered(req.params.order_id, req.params.product_name);
      res.status(200).end('Update Completed!');
    } catch (err) {
      res.status(503).json({
        code: 503,
        error: `Unavailable service during the update of order`,
      });
    }
  }
);

//PUT to update a product as prepared
app.put(
  '/api/orders/:order_id/:product_name',

  async (req, res) => {
    try {
      await ordersDao.prepared(req.params.order_id, req.params.product_name);
      res.status(200).end('Update Completed!');
    } catch (err) {
      res.status(503).json({
        code: 503,
        error: `Unavailable service during the update of order`,
      });
    }
  }
);

//POST the product IDs to be set with state 'farmer_shipped'
app.post('/api/orders/farmershipped', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    console.log(req.body);

    const productIDS = req.body;

    console.log(productIDS);

    for (const product of productIDS) {
      await ordersDao.setOrderAsFarmerShipped(product);
    }
    res.json(true);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET all confirmed for sale products
app.get('/api/products/confirmed/:year/:week', async (req, res) => {
  try {
    const year = req.params.year;
    const week = req.params.week;
    const products = await productsDAO.getAllConfirmedProducts(year, week);
    res.json(products);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET all expected products
app.get('/api/products/expected/:year/:week', async (req, res) => {
  try {
    const year = req.params.year;
    const week = req.params.week;
    const products = await productsDAO.getAllExpectedProducts(year, week);
    res.json(products);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET product by its ID
app.get('/api/product/:product_id', async (req, res) => {
  try {
    const product_id = req.params.product_id;
    const product = await productsDAO.getProductById(product_id);
    res.json(product);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET all booked orders for a certain provider
app.get('/api/products/ordered/:year/:week_number', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'farmer') {
      res.status(401).json({ error: 'Unauthorized user' });
      return;
    }

    const year = req.params.year;
    const week_number = req.params.week_number;
    const provider_id = await dbt.getProviderIDfromUserID(req.user.id);

    const products = await ordersDao.getBookedOrders(
      provider_id,
      year,
      week_number
    );
    res.json(products);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET all categories
app.get('/api/products/categories', async (req, res) => {
  try {
    const categories = await productsDAO.getAllCategories();
    res.json(categories);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET cleints and orders data for pickup
app.get('/api/orders/pickup/clientorder', async (req, res) => {
  try {
    const orders = await ordersDao.getOrderAndClientForPickup();
    res.json(orders);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//Get all providers
app.get('/api/providers/all', async (req, res) => {
  try {
    const providers = await providersDAO.getAllProviders();
    res.json(providers);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET provider by its ID
app.get('/api/provider/:provider_id', async (req, res) => {
  try {
    const provider_id = req.params.provider_id;
    const provider = await providersDAO.getProviderById(provider_id);
    res.json(provider);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//Get provider products
app.get('/api/provider-products', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    const provider_id = await dbt.getProviderIDfromUserID(req.user.id);
    const providerProducts = await providersDAO.getProviderExistingProducts(
      provider_id
    );
    res.json(providerProducts);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});
app.post('/api/neworder', async (req, res) => {
  try {
    const client_id = req.body.client_id;
    const totalorderprice = req.body.total;
    const order_items = req.body.order_items;
    let response, response1;

    const order_id = await ordersDao.insert_order(client_id, totalorderprice);
    order_items.forEach(async (prod) => {
      if (prod.quantity >= prod.qty) {
        response = await ordersDao.insert_order_items(order_id, prod);
        if (response.status !== 'OK') throw 'something goes wrong';
      } else throw 'We do not have enough product ';
      const newQuantity = prod.quantity - prod.qty;
      response1 = await productsDAO.putProductQuantity(prod.id, newQuantity);
    });

    res.json(response);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});
//Post the notification as sent
app.put('/api/provider-products-sent/', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }
  try {
    //const ids = new Array();
    const ids = req.body.map((p) => p.id);
    let result_change_notification = false;
    for (let pid of ids) {
      console.log(pid);
      result_change_notification = await providersDAO.postProviderNotification(
        pid
      );
    }
    if (!result_change_notification) {
      throw 'postProviderNotification failed';
    }
    res.json(result_change_notification);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});
//Get provider products that are not available and not notificated to the farmer
app.get('/api/provider-products-notification', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }
  try {
    const provider_id = await dbt.getProviderIDfromUserID(req.user.id);
    const providerProducts = await providersDAO.getProviderProductsNotification(
      provider_id
    );

    res.json(providerProducts);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//CHECK provider's confirmation status
app.get(
  '/api/provider/confirmationStatus/:year/:week_number',
  async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'farmer') {
      res.status(401).json({ error: 'Unauthorized user' });
      return;
    }
    try {
      const year = req.params.year;
      const week_number = req.params.week_number;
      const provider_id = await dbt.getProviderIDfromUserID(req.user.id);

      const confirmationStatus =
        await providersDAO.checkProviderAvailabilityConfirmation(
          provider_id,
          year,
          week_number
        );
      res.json(confirmationStatus);
    } catch (err) {
      console.log(err);
      res.json(err);
    }
  }
);

//GET provider's expected production
app.get(
  '/api/products/provider/expected/:year/:week_number',
  async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'farmer') {
      res.status(401).json({ error: 'Unauthorized user' });
      return;
    }

    try {
      const year = req.params.year;
      const week_number = req.params.week_number;
      const provider_id = await dbt.getProviderIDfromUserID(req.user.id);

      const expectedProducts = await productsDAO.getProviderExpectedProducts(
        provider_id,
        year,
        week_number
      );
      res.json(expectedProducts);
    } catch (err) {
      console.log(err);
      res.json(err);
    }
  }
);

//GET providers shipment status
app.get('/api/provider/shipmentstatus/:year/:week_number', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    const year = req.params.year;
    const week_number = req.params.week_number;

    const provider_id = await dbt.getProviderIDfromUserID(req.user.id);

    const shipmentStatus = await ordersDao.getProviderShipmentStatus(
      provider_id,
      year,
      week_number
    );
    res.json(shipmentStatus);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//GET provider shipped orders
app.get(`/api/provider-orders/:id`, async (req, res) => {
  try {
    const id = req.params.id;

    const farmerShippedOrders = await warehouseDao.getProviderShippedOrders(id);

    res.json(farmerShippedOrders);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//Insert provider's expected production
app.post('/api/products/expected/:year/:week_number', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    const products = req.body;
    const year = req.params.year;
    const week_number = req.params.week_number;

    const provider_id = await dbt.getProviderIDfromUserID(req.user.id);

    const oldProductIDs = (
      await productsDAO.getProviderExpectedProducts(
        provider_id,
        year,
        week_number
      )
    ).map((p) => p.id);
    const productIDs = [];

    await productsDAO.deleteExpectedProducts(provider_id, year, week_number);
    oldProductIDs.forEach((p) => {
      if (
        fs.existsSync(__dirname + '/../client/public/products/' + p + '.jpg')
      ) {
        fs.unlinkSync(__dirname + '/../client/public/products/' + p + '.jpg');
      }
    });
    for (const product of products) {
      const newID = await productsDAO.insertNewExpectedProduct(
        product,
        provider_id
      );
      productIDs.push({ old_id: product.id, new_id: newID });
    }
    console.log(productIDs);
    res.json(productIDs);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

//UPLOAD image
app.post('/api/products/upload/expected/:img_id', (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  if (!req.files) {
    return res.status(400).send('No files were uploaded.');
  }

  const filename = req.params.img_id;

  let file = req.files.product_image;

  file.name = filename + '.jpg';
  const imgpath = __dirname + '/../client/public/products/' + file.name;

  file.mv(imgpath, (err) => {
    if (err) {
      return res.status(500).send(err);
    }
    return res.send({ status: 'success', path: imgpath });
  });
});

app.get('/users/email-availability/:email', async (req, res) => {
  try {
    const email = req.params.email;
    res.json(await dbt.checkIfEmailExists(email));
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

app.post('/provider/apply', async (req, res) => {
  try {
    let farmer = req.body;
    console.log(farmer);
    var salt = bcrypt.genSaltSync(10);
    farmer.password = await bcrypt.hash(farmer.password, salt);
    res.json(await providersDAO.insertFarmerApplication(farmer));
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

app.get('/manager/applications/pending', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'shop-manager') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    res.json(await providersDAO.getPendingApplications());
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

app.get('/manager/applications/accepted', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'shop-manager') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    res.json(await providersDAO.getAcceptedApplications());
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

app.get('/manager/applications/accept/:application_id', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'shop-manager') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    const application_id = req.params.application_id;
    res.json(await providersDAO.acceptApplication(application_id));
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

app.get('/manager/applications/reject/:application_id', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'shop-manager') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  try {
    const application_id = req.params.application_id;
    res.json(await providersDAO.rejectApplication(application_id));
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

app.post('/api/neworder', async (req, res) => {
  try {
    const client_id = req.body.client_id;
    const totalorderprice = req.body.total;
    const order_items = req.body.order_items;
    let response, response1;

    const order_id = await ordersDao.insert_order(client_id, totalorderprice);
    order_items.forEach(async (prod) => {
      if (prod.quantity >= prod.qty) {
        response = await ordersDao.insert_order_items(order_id, prod);
        if (response.status !== 'OK') throw 'something goes wrong';
      } else throw 'We do not have enough product ';
      const newQuantity = prod.quantity - prod.qty;
      response1 = await productsDAO.putProductQuantity(prod.id, newQuantity);
    });

    res.json(response);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});
//update quantity
app.put('/api/modifyquantity', async (req, res) => {
  productsDAO
    .putProductQuantity(req.body.id, req.body.quantity)
    .then(() => {
      res.status(200).json();
      return res;
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json(error);
    });
});

//update quantity
app.put('/api/farmerConfirm/:product_id/:year/:week', async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== 'farmer') {
    res.status(401).json({ error: 'Unauthorized user' });
    return;
  }

  const provider_id = await dbt.getProviderIDfromUserID(req.user.id);
  productsDAO
    .confirmExpectedProduct(
      provider_id,
      req.params.product_id,
      req.params.year,
      req.params.week
    )
    .then(() => {
      res.status(200).json();
      return res;
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json(error);
    });
});

// adding a client

app.post('/api/clients', async (req, res) => {
  try {
    var salt = bcrypt.genSaltSync(10);
    const oldPassword = req.body.hash;
    const hashedPassword = await bcrypt.hash(oldPassword, salt);
    const client = {
      budget: req.body.budget,
      name: req.body.name,
      surname: req.body.surname,
      gender: req.body.gender,
      birthdate: req.body.birthdate,
      country: req.body.country,
      region: req.body.region,
      address: req.body.address,
      city: req.body.city,
      phone: req.body.phone,
      email: req.body.email,
      hash: hashedPassword,
    };
    if (!client) {
      res.status(400).end();
    } else {
      await clientsDao
        .createClient(client)
        .then((id) => res.status(201).end('New Client was added !'))
        .catch((err) => res.status(500).json(error));
    }
  } catch (e) {
    console.log(e);
    res.status(500).send('Unavailable service while adding new client!');
  }
});

app.get('/api/methods', (req, res) => {
  walletsDAO
    .listAllPaymentMethods()
    .then((methods) => {
      res.json(methods);
    })
    .catch((error) => {
      res.status(500).json(error);
    });
});

app.put('/api/clients/update/balance/:clientId/:amount', async (req, res) => {
  const clientId = req.params.clientId;
  const amount = req.params.amount;
  try {
    await walletsDAO.increaseBalance(amount, clientId);
    res.json(`Balance of client : ${clientId} was increased`);
  } catch (error) {
    res
      .status(500)
      .json(
        `Error while updating the balance of user with id: ${clientId}   ` +
        error
      );
  }
});

app.post('/api/transactions', (req, res) => {
  const transaction = req.body;
  if (!transaction) {
    res.status(400).end();
  } else {
    walletsDAO
      .createTransaction(transaction)
      .then((id) => res.status(201).json({ id: id }))
      .catch((err) => res.status(500).json(error));
  }
});
//POST ->add users
app.post(
  '/api/users',

  async (req, res) => {
    var salt = bcrypt.genSaltSync(10);
    const oldPassword = req.body.hash;
    const hashedPassword = await bcrypt.hash(oldPassword, salt);
    const t = {
      id: req.body.id,
      name: req.body.name,
      email: req.body.email,
      hash: hashedPassword,
      role: req.body.role,
    };
    try {
      await dbt.addclient(t);
      res.status(201).end('Added client as a user!');
    } catch (err) {
      res.status(503).json({ code: 503, error: 'Unavailable service.' });
    }
  }
);

//POST ->orders
app.post('/api/orderinsert', async (req, res) => {
  try {
    const t = {
      order_id: req.body.order_id,
      client_id: req.body.client_id,
      product_name: req.body.product_name,
      product_id: req.body.product_id,
      order_quantity: req.body.order_quantity,
      state: req.body.state,
      OrderPrice: req.body.OrderPrice,
      id: req.body.id,
      city: req.body.city,
      Nation: req.body.Nation,
      zipcode: req.body.zipcode,
      address: req.body.address,
      date: req.body.date,
      time: req.body.time,
      pickup: req.body.pickup,
    };
    await ordersDao.addOrder(t);
    res.status(201).end('Created order!');
  } catch (err) {
    console.log(err);
    res.status(503).json({
      code: 503,
      error: 'Unavailable service during the create of the order.',
    });
  }
});

//DELETE ->order item
app.delete('/api/orders/:id', async (req, res) => {
  try {
    await ordersDao.deleteItem(req.params.id);
    res.status(204).end('order item deleted!');
  } catch (err) {
    res.status(503).json({
      code: 503,
      error: `Unavailable service error during the delete of the order item`,
    });
  }
});
//GET all users
app.get('/api/users', async (req, res) => {
  try {
    const m = await dbt.getAllUsers();
    return res.status(200).json(m);
  } catch (err) {
    res.status(500).json({
      code: 500,
      error: 'Database error during the retrieve of the list of users.',
    });
  }
});
// PUT item order
app.put('/api/orders/:id', async (req, res) => {
  const order = req.body;

  try {
    await ordersDao.changeItem(order);
    res.status(200).json(order);
  } catch (err) {
    res
      .status(503)
      .json({ error: `Database error during the update of order .` });
  }
});

//GET all deliverers
app.get('/api/deliverers', async (req, res) => {
  try {
    const m = await deliverersDao.getAllDeliverers();
    return res.status(200).json(m);
  } catch (err) {
    res.status(500).json({
      code: 500,
      error: 'Database error during the retrieve of the list of orders.',
    });
  }
});

//GET deliverable orders
app.get('/api/deliverableOrders/:city', async (req, res) => {
  try {
    const city = req.params.city;
    const orders = await deliverersDao.getAllDeliverableOrders(city);
    res.json(orders);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

// PUT update state
app.put('/api/modifyStato', async (req, res) => {
  deliverersDao
    .changeState(req.body.id, req.body.product, req.body.state)
    .then(() => {
      res.status(200).json();
      return res;
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json(error);
    });
});

//GET deliverer by its mail
app.get('/api/deliverer/:deliverer_mail', async (req, res) => {
  try {
    const deliverer_mail = req.params.deliverer_mail;
    const deliverer = await deliverersDao.getDelivererByMail(deliverer_mail);
    res.json(deliverer);
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

module.exports = app;

/* CONNECTION */
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);

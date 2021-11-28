'use strict';

const sqlite = require('sqlite3');

const db = new sqlite.Database('spg.db', (err) => {
  if (err) {
    throw err;
  }
});

exports.getAllConfirmedProducts = (year, week) => {
  return new Promise((resolve, reject) => {
    const product_status = 'confirmed';
    const sql =
      'SELECT * FROM products, providers, product_categories WHERE products.year=? AND products.week_number=? AND products.product_status=? AND products.category_id=product_categories.category_id AND products.provider_id=providers.provider_id';
    db.all(sql, [year, week, product_status], (err, rows) => {
      if (err) {
        reject(err);
      }
      const products = rows.map((p) => ({
        id: p.product_id,
        name: p.product_name,
        description: p.product_description,
        category: p.category_name,
        price: p.product_price,
        unit: p.product_unit,
        quantity: p.product_quantity,
        expiryDate: p.product_expiry,
        providerId: p.provider_id,
        providerName: p.provider_name,
        year: p.year,
        week: p.week_number,
        status: p.product_status,
        active: 1
      }));
      resolve(products);
    });
  });
};

exports.getAllExpectedProducts = (year, week) => {
  return new Promise((resolve, reject) => {
    const product_status = 'expected';
    const sql =
      'SELECT * FROM products, providers, product_categories WHERE products.year=? AND products.week_number=? AND products.product_status=? AND products.category_id=product_categories.category_id AND products.provider_id=providers.provider_id';
    db.all(sql, [year, week, product_status], (err, rows) => {
      if (err) {
        reject(err);
      }
      const products = rows.map((p) => ({
        id: p.product_id,
        name: p.product_name,
        description: p.product_description,
        category: p.category_name,
        price: p.product_price,
        unit: p.product_unit,
        quantity: p.product_quantity,
        expiryDate: p.product_expiry,
        providerId: p.provider_id,
        providerName: p.provider_name,
        year: p.year,
        week: p.week_number,
        status: p.product_status,
        active: 1
      }));
      resolve(products);
    });
  });
};

exports.getProductById = (product_id) => {
  return new Promise((resolve, reject) => {
    const sql =
      'SELECT * FROM products, providers, product_categories WHERE products.product_id=? AND products.category_id=product_categories.category_id AND products.provider_id=providers.provider_id';
    db.get(sql, [product_id], (err, row) => {
      if (err) {
        reject(err);
      }
      const product = {
        id: row.product_id,
        name: row.product_name,
        description: row.product_description,
        category: row.category_name,
        price: row.product_price,
        unit: row.product_unit,
        quantity: row.product_quantity,
        expiryDate: row.product_expiry,
        providerId: row.provider_id,
        providerName: row.provider_name,
        active: 1
      };
      resolve(product);
    });
  });
};

exports.getAllCategories = () => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT category_id, category_name FROM product_categories';
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      }
      const categories = rows.map((c) => ({
        id: c.category_id,
        name: c.category_name,
        active: 0
      }));
      resolve(categories);
    });
  });
};

exports.putProductQuantity = (product_id, quantity) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE products SET product_quantity=? Where product_id=?';
    db.run(sql, [quantity, product_id], (err) => {
      if (err) {
        console.log(err);
        reject(err.message);
        return;
      }
      resolve();
    });
  });
};

exports.getProviderExpectedProducts = (provider_id, year, week_number) => {
  return new Promise((resolve, reject) => {
    const product_status = 'expected';
    const sql =
      'SELECT * FROM products WHERE products.provider_id=? AND products.year=? AND products.week_number=? AND products.product_status=?';
    db.all(sql, [provider_id, year, week_number, product_status], (err, rows) => {
      if (err) {
        reject(err);
      }
      const products = rows.map((p) => ({
        id: p.product_id,
        name: p.product_name,
        description: p.product_description,
        category: p.category_id,
        price: p.product_price,
        unit: p.product_unit,
        quantity: p.product_quantity,
        expiryDate: p.product_expiry,
        providerId: p.provider_id,
        year: p.year,
        week: p.week_number,
        status: p.product_status
      }));
      resolve(products);
    });
  });
}

exports.deleteExpectedProducts = (provider_id, year, week_number) => {
  return new Promise((resolve, reject) => {
    const product_status = 'expected';
    const sql = 'DELETE from products WHERE provider_id=? AND year=? AND week_number=? AND product_status=?';
    db.run(sql, [provider_id, year, week_number, product_status], (err) => {
      if (err) {
        console.log(err);
        reject(err.message);
        return;
      }
      resolve();
    });
  });
}

exports.insertNewExpectedProduct = (prod, provider_id) => {
  return new Promise((resolve, reject) => {
    const product_status = 'expected';
    const sql = "INSERT INTO products(product_name, product_description, category_id, product_price, product_unit, product_quantity, provider_id, year, week_number, product_status) VALUES(?,?,?,?,?,?,?,?,?,?)";
    db.run(sql, [prod.name, prod.description, prod.category, prod.price, prod.unit, prod.quantity, provider_id, prod.year, prod.week_number, product_status], function (err) {
      if (err) {
        reject(err);
      }
      console.log(this);
      resolve(this.lastID);
    }
    );
  });
}

exports.getBookedOrders = (provider_id, year, week_number) => {
  return new Promise((resolve, reject) => {
    const sql =
      'SELECT products.product_id AS productID, products.product_name, SUM(order_quantity) AS TotQty, products.product_unit, orders.state '+ 
      'FROM products, orders '+
      'WHERE products.provider_id=? AND products.year=? AND products.week_number=? AND products.product_id=orders.product_id '+
      'GROUP BY products.product_id, products.product_name, products.product_unit, orders.state';
    db.all(sql, [provider_id, year, week_number], (err, rows) => {
      if (err) {
        reject(err);
      }
      console.log(rows);
      const products = rows.map((p) => ({
        id: p.productID,
        name: p.product_name,
        tot_quantity: p.TotQty,
        unit: p.product_unit,
        state: p.state
      }));
      resolve(products);
    });
  });
}

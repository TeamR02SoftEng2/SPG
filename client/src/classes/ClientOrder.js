function clientOrders(
  order_id,
  client_id,
  product_name,
  product_id,
  state,
  OrderPrice,
  id,
  address,
  city,
  nation,
  zipcode,
  date,
  time
) {
  console.log("Class "+product_id);
  this.order_id = order_id;
  this.client_id = client_id;
  this.product_name = product_name;
  this.product_id = product_id;
  this.state = state;
  this.OrderPrice = OrderPrice;
  this.id = null;
  this.address = address;
  this.city = city;
  this.nation = nation;
  this.zipcode = zipcode;
  this.date = date;
  this.time = time;
}
export { clientOrders };

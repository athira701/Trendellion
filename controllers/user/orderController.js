const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");
const Wallet = require("../../models/walletSchema");

const placeOrder = async (req, res) => {
  try {
    const { addressId, couponCode, paymentMethod } = req.body;
    const userId = req.session.user._id;
    console.log("USERID:", userId);

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Please login to continue" });
    }

    const cart = await Cart.findOne({ userId }).populate("item.productId");
    const user = await User.findById(userId);
    const userAddress = await Address.findOne({ userId });
    console.log("userAddress:",userAddress);

    if (!cart || !cart.item || cart.item.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Your cart is empty" });
    }

    const defaultAddress = userAddress.address.find(
      (addr) => addr.isDefault === true
    );
    console.log("defaultAddress:",defaultAddress)
    if (!defaultAddress) {
      return res.status(400).json({
        success: false,
        message: "Please set a default delivery address",
      });
    }

    // Validate payment method

    if (!["COD", "ONLINE"].includes(paymentMethod?.toUpperCase())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment method" });
    }

    // Calculate totals and prepare order items
    const orderItems = [];
    for (const item of cart.item) {
      const product = item.productId;
      const sizeIndex = product.stock.findIndex((s) => s.size === item.size);
      if (product.stock[sizeIndex].quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}`,
        });
      }

      product.stock[sizeIndex].quantity -= item.quantity;
      product.totalStock -= item.quantity;
      await product.save();

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        size: item.size,
        price: item.price,
      });
    }

    const cartTotal = cart.cartTotal;
    const discountAmount = cart.discountAmount || 0;
    const discountedTotal = cart.discountedTotal;
    const deliveryFee = cartTotal > 1000 ? 0 : 100;
    const totalAmount = discountedTotal + deliveryFee;

    if (paymentMethod.toUpperCase() === "COD" && totalAmount > 1000) {
      return res.status(400).json({
        success: false,
        message:
          "Cash on Delivery is not available for orders above Rs 1000. Please choose online payment.",
      });
    }

    const order = new Order({
      userId,
      orderedItems: orderItems,
      cartTotal,
      discountAmount,
      discountedTotal,
      deliveryFee,
      totalAmount,
      address: defaultAddress,
      paymentMethod: paymentMethod.toUpperCase(),
      paymentStatus: paymentMethod === "COD" ? "PENDING" : "PAID",
      orderStatus: "PENDING",
      couponCode: couponCode || "",
    });

    await order.save();

    // Reset cart completely to avoid negative values
    cart.item = [];
    cart.cartTotal = 0;
    cart.discountAmount = 0;
    cart.discountedTotal = 0;
    cart.appliedCoupon = null;
    await cart.save();

    req.session.couponApplied = false;

    req.session.orderId = order.orderId;
    res.json({
      success: true,
      message:
        paymentMethod === "ONLINE"
          ? "Redirecting to payment gateway"
          : "Order placed successfully",
      orderId: order.orderId,
    });
  } catch (error) {
    console.log("Order placement error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to place order",
    });
  }
};

const orderPlacedpage = async (req, res) => {
  try {
    const orderId = req.session.orderId;
    console.log("OrderId:", orderId); // or req.params depending on the route setup

    delete req.session.orderId;
    res.render("user/orderPlaced", { orderId });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
const getOrderPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const searchQuery = req.query.search || "";

    const filter = { userId };
    if (searchQuery) {
      filter.orderId = { $regex: searchQuery, $options: "i" };
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    
    const orders = await Order.find(filter)
      .populate({
        path: "orderedItems.product",
        select: "name price", 
      })
      .sort({ createdAt: -1 }) 
      .skip((page - 1) * limit)
      .limit(limit);
    console.log("Orders:", orders);

    res.render("user/orders", {
      orders,
      user: req.session.user,
      currentPage: page,
      totalPages,
      searchQuery,
      totalOrders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("Error loading orders page");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    
    const order = await Order.findOne({ orderId: orderId })
      .populate("userId")
      .populate("orderedItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }
    console.log("Order status:", order.orderStatus);

    const orderData = {
      orderId: order.orderId,
      name: order.address.name,
      address: `${order.address.landMark}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}`,
      phone: order.address.phone,
      orderedItems: order.orderedItems.map((item) => ({
        productName: item.product.productName,
        productImage: item.product.productImage,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      currentStage: getCurrentStage(order.orderStatus),
      dates: getOrderDates(order),
    };
    console.log("orderData:", orderData);

   
    res.render("user/orderDetails", { order: orderData });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getCurrentStage = (orderStatus) => {
  const stages = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];
  return stages.indexOf(orderStatus);
};

// Helper function to get dates for each stage (this is just a placeholder)
const getOrderDates = (order) => {
  // You can customize this function to return actual dates based on your order tracking logic
  return ["2023-10-01", "2023-10-02", "2023-10-03", "2023-10-04"];
};

const cancelOrderItem = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    

    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    console.log("jhagsjdgash", order);

    if (
      order.orderStatus === "DELIVERED" ||
      order.orderStatus === "CANCELLED"
    ) {
      return res.status(400).json({ message: "Order cannot be cancelled" });
    }

    if (order.paymentMethod === "ONLINE" || order.paymentMethod === "Wallet") {
      const userId = order.userId._id ? order.userId._id : order.userId;
      console.log("User ID of cancelled order is Here:", userId);

      let wallet = await Wallet.findOne({ userId: userId });
      console.log("Wallet found:", wallet ? "Yes" : "No");

      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          balance: 0,
          transactions: [],
        });
      }

      console.log("Before refund - Wallet balance:", wallet.balance);
      console.log("Refund amount:", order.totalAmount);

      wallet.balance += order.totalAmount;

      wallet.transactions.push({
        amount: order.totalAmount,
        transactionsMethod: "REFUND",
        date: new Date(),
        orderId: order._id,
        status: "completed",
      });
      console.log("After refund - Wallet balance:", wallet.balance);

      await wallet.save();

      order.paymentStatus = "REFUNDED";
    }

    order.orderStatus = "CANCELLED";
    await order.save();

    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const stockEntry = product.stock.find(
          (stock) => stock.size === item.size
        );
        if (stockEntry) {
          stockEntry.quantity += item.quantity;
          product.totalStock += item.quantity;
          await product.save();
        }
      }
    }

    res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const returnOrderItem = async (req, res) => {
  try {
    console.log("hellooooooooooooooo");
    const orderId = req.params.orderId;
    const { returnReason, returnDetails } = req.body;

    // Find the order
    const order = await Order.findOne({ orderId: orderId }).populate(
      "orderedItems.product"
    );
    console.log("Order in the return order section:", order);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("Current order status:", order.orderStatus);
    if (order.orderStatus.toUpperCase() !== "DELIVERED") {
      return res.status(400).json({
        message: "Only delivered orders can be returned",
        currentStatus: order.orderStatus, 
      });
    }

    // Check return time limit (30 days)
    const deliveryDate = order.updatedAt; 
    const daysSinceDelivery = Math.floor(
      (Date.now() - deliveryDate) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceDelivery > 30) {
      return res
        .status(400)
        .json({ message: "Return period has expired (30 days limit)" });
    }

    
    order.orderStatus = "RETURN REQUESTED";
    order.returnReason = returnReason || "Not specified";
    order.returnDetails = returnDetails || ""; 
    order.returnRequestedAt = new Date(); 

    await order.save();

    // Optional: Add notification logic here (e.g., email to admin)
    // Example: await sendAdminNotification(order);

    res.status(200).json({
      message: "Return request submitted successfully",
      orderId: order.orderId,
      returnReason: order.returnReason,
      returnDetails: order.returnDetails,
    });
  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  placeOrder,
  orderPlacedpage,
  getOrderPage,
  getOrderDetails,
  cancelOrderItem,
  returnOrderItem,
};

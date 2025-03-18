const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Razorpay = require('razorpay')
const crypto = require('crypto')
const Cart = require("../../models/cartSchema");
const Address=require('../../models/addressSchema')

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);

    let wallet = await Wallet.findOne({ userId });

    const walletBalance = wallet ? wallet.balance : 0;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const transactions = wallet
      ? wallet.transactions
          .slice()
          .reverse()
          .slice(skip, skip + limit)
      : [];

    const totalTransactions = wallet ? wallet.transactions.length : 0;
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render("user/wallet", {
      user,
      walletBalance,
      transactions,
      currentPage: page,
      totalPages,
      message: null,
    });
  } catch (error) {
    console.error("Error while rendering wallet:", error);
    res.status(500).send("Internal server error");
  }
};

const createWallet = async (req, res) => {
  try {
    const userId = req.session.user._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    let wallet = await Wallet.findOne({ userId });
    if (wallet) {
      return res.status(400).json({
        success: false,
        message: "Wallet already exists",
      });
    }

    wallet = new Wallet({
      userId,
      balance: 0,
      transactions: [],
    });

    await wallet.save();

    res.status(200).json({
      success: true,
      message: "Wallet created successfully",
    });
  } catch (error) {
    console.error("Error creating wallet:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const addMoney = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { amount } = req.body;
    console.log("Amount to be added:",amount)

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    if (amount > 10000) {
      return res.status(400).json({ message: "₹10,000 is the one-time limit" });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(400).json({ message: "Wallet not found" });
    }
    console.log("Wallet found or not.",wallet)

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `wallet_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error("Error while adding money:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
    } = req.body;
    const userId = req.session.user._id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(400).json({ message: "Wallet not found" });
    }

    const parsedAmount = parseFloat(amount);
    const newTransaction = {
      amount: parsedAmount,
      transactionsMethod: "Money Added via Razorpay",
      date: new Date(),
      status: "completed",
    };

    wallet.balance += parsedAmount;
    wallet.transactions.push(newTransaction);
    await wallet.save();

    res.json({
      message: "Money added successfully!",
      newBalance: wallet.balance,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Payment verification failed" });
  }
};

const processWalletPayment = async (req, res) => {
  try {
    const { paymentMethod, amount } = req.body;
    const userId = req.session.user._id;
    console.log("USERID:", userId);
    console.log("paymentmeth", paymentMethod);

    // Validate user session
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Please login to continue" });
    }

    // Get cart and user data
    const cart = await Cart.findOne({ userId }).populate("item.productId");
    const user = await User.findById(userId);
    const userAddress = await Address.findOne({ userId });

    // Validate cart
    if (!cart || !cart.item || cart.item.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Your cart is empty" });
    }

    // Get default address
    const defaultAddress = userAddress.address.find(
      (addr) => addr.isDefault === true
    );
    if (!defaultAddress) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please set a default delivery address",
        });
    }

    // Calculate totals and prepare order items
    const orderItems = [];
    for (const item of cart.item) {
      const product = item.productId;
      const sizeIndex = product.stock.findIndex((s) => s.size === item.size);
      if (product.stock[sizeIndex].quantity < item.quantity) {
        return res
          .status(400)
          .json({
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

    // Handle wallet payment
    // Find user's wallet
    let wallet = await Wallet.findOne({ userId });
    console.log("wallet", wallet);
    if (!wallet) {
      return res.status(400).json({ 
        success: false, 
        message: "Wallet not found" 
      });
    }

    // Check if wallet has sufficient balance
    if (wallet.balance < totalAmount) {
      return res.status(400).json({ 
        success: false, 
        message: "Insufficient wallet balance" 
      });
    }

    // Create the order with appropriate payment status
    const order = new Order({
      userId,
      orderedItems: orderItems,
      cartTotal,
      discountAmount,
      discountedTotal,
      deliveryFee,
      totalAmount,
      address: defaultAddress,
      paymentMethod: "Wallet",
      paymentStatus: "PAID",
      orderStatus: "PENDING",
      couponCode: ""
    });

    const savedOrder = await order.save();

    // Deduct amount from wallet
    wallet.balance -= totalAmount;
    
    // Add transaction record - NOTE: Using _id which is an ObjectId instead of orderId which is a string
    const newTransaction = {
      amount: -totalAmount,
      transactionsMethod: "Order Payment",
      date: new Date(),
      orderId: savedOrder._id, // Using the MongoDB _id instead of the UUID orderId
      status: "completed"
    };
    
    wallet.transactions.push(newTransaction);
    await wallet.save();

    // Reset cart completely to avoid negative values
    cart.item = [];
    cart.cartTotal = 0;
    cart.discountAmount = 0;
    cart.discountedTotal = 0;
    cart.appliedCoupon = null;
    await cart.save();

    req.session.couponApplied = false;
    req.session.orderId = order.orderId;

    return res.json({
      success: true,
      message: "Order placed successfully with wallet payment",
      orderId: order.orderId,
      newBalance: wallet.balance
    });
  } catch (error) {
    console.log("Order placement error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to place order",
      });
  }
};

module.exports = {
  getWalletPage,
  createWallet,
  addMoney,
  verifyPayment,
  processWalletPayment,
};

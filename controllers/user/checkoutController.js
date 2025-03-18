const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Wallet = require("../../models/walletSchema");

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const wallet = await Wallet.findOne({ userId: userId });

    // Fetch the user's addresses and find the default one
    const userAddress = await Address.findOne({ userId });
    let defaultAddress = null;
    if (userAddress && userAddress.address.length > 0) {
      defaultAddress =
        userAddress.address.find((addr) => addr.isDefault === true) ||
        userAddress.address[0];
    }

    // Fetch the user's cart details
    let userCart = await Cart.findOne({ userId }).populate("appliedCoupon");
    console.log("userCart in the getcheckoutPage function:", userCart);

    let cartItems = [];
    let cartTotal = 0;
    let discountAmount = 0;
    let discountedTotal = 0;
    let deliveryFee = 100;
    let totalAmount = 0;
    let couponCode = "";

    if (userCart && userCart.item.length > 0) {
      cartItems = userCart.item;
      cartTotal = Number(userCart.cartTotal) || 0; // Explicitly convert to number
      console.log("Converted cartTotal:", cartTotal, "Type:", typeof cartTotal);

      // Only apply discount if coupon was applied in this checkout session and is valid
      if (req.session.couponApplied && userCart.appliedCoupon) {
        const coupon = userCart.appliedCoupon;
        if (
          coupon.status &&
          coupon.expiry > Date.now() &&
          coupon.usedCount < coupon.maxRedeem
        ) {
          discountAmount = Number(userCart.discountAmount) || 0;
          discountedTotal = Number(userCart.discountedTotal) || cartTotal;
          couponCode = coupon.couponCode;
        } else {
          // Reset invalid coupon
          userCart.appliedCoupon = null;
          userCart.discountAmount = 0;
          userCart.discountedTotal = cartTotal;
          await userCart.save();
          // Reload cart to ensure consistency
          userCart = await Cart.findOne({ userId }).populate("appliedCoupon");
        }
      } else if (userCart.discountAmount > 0 || userCart.appliedCoupon) {
        // Reset coupon data if not applied in this session
        userCart.appliedCoupon = null;
        userCart.discountAmount = 0;
        userCart.discountedTotal = cartTotal;
        await userCart.save();
        // Reload cart to ensure consistency
        userCart = await Cart.findOne({ userId }).populate("appliedCoupon");
      }

      // Set values after potential reset
      discountAmount = Number(userCart.discountAmount) || 0;
      discountedTotal = Number(userCart.discountedTotal) || cartTotal;
      couponCode = userCart.appliedCoupon
        ? userCart.appliedCoupon.couponCode
        : "";
      deliveryFee = cartTotal > 1000 ? 0 : 100;
      totalAmount = discountedTotal + deliveryFee;
    }

    // Reset session flag for new checkout flow
    req.session.couponApplied = false;

    console.log("Final userCart:", userCart); // Log after all modifications

    res.render("user/checkout", {
      defaultAddress,
      cartItems,
      cartTotal: cartTotal,
      discountAmount,
      discountedTotal,
      deliveryFee,
      totalAmount,
      cart: userCart,
      couponCode,
      wallet,
    });
  } catch (error) {
    console.error("Error fetching checkout page:", error);
    res.status(500).send("Internal Server Error");
  }
};

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { couponCode } = req.body;

    console.log("Received Coupon Code:", couponCode);

    if (!couponCode) {
      return res
        .status(400)
        .json({ success: false, message: "No coupon code provided" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }
    const ourCoupon = couponCode.toUpperCase();
    const coupon = await Coupon.findOne({ couponCode: ourCoupon });

    if (!coupon || !coupon.status || coupon.expiry < Date.now()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired coupon" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.usedCoupons?.includes(coupon._id.toString())) {
      return res
        .status(400)
        .json({ success: false, message: "Coupon already used" });
    }

    const discountAmount = (cart.cartTotal * coupon.discount) / 100;
    console.log("discountAmount:", discountAmount);
    cart.appliedCoupon = coupon._id;
    cart.discountAmount = discountAmount;
    cart.discountedTotal = cart.cartTotal - discountAmount;
    await cart.save();

    if (!user.usedCoupons) {
      user.usedCoupons = [];
    }
    user.usedCoupons.push(coupon._id);
    await user.save();

    coupon.usedCount += 1;
    await coupon.save();

    const deliveryFee = cart.cartTotal > 1000 ? 0 : 100;
    const totalAmount = cart.discountedTotal + deliveryFee;

    req.session.couponApplied = true;

    res.status(200).json({
      success: true,
      discountAmount,
      discountedTotal: cart.discountedTotal,
      totalAmount,
      message: "Coupon applied successfully",
    });
    console.log("77777");
  } catch (error) {
    console.error("Error applying coupon:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error applying coupon" });
  }
};

const availableCoupons = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Fetch user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Fetch user to check used coupons
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch all active coupons
    const coupons = await Coupon.find({ status: true });

    // Filter coupons based on cartTotal, expiry, and user eligibility
    const validCoupons = coupons.filter((coupon) => {
      const isNotExpired = coupon.expiry > Date.now();
      const meetsMinimumPrice = cart.cartTotal >= coupon.minimumPrice;
      const notUsedByUser = !user.usedCoupons?.includes(coupon._id.toString());
      const withinRedeemLimit = coupon.usedCount < coupon.maxRedeem;

      return (
        isNotExpired && meetsMinimumPrice && notUsedByUser && withinRedeemLimit
      );
    });

    // Format coupons for frontend
    const formattedCoupons = validCoupons.map((coupon) => ({
      code: coupon.couponCode,
      description: `${coupon.discount}% off (Min. ₹${coupon.minimumPrice})`,
      validUntil: new Date(coupon.expiry).toLocaleDateString(),
    }));

    res.json({
      success: true,
      coupons: formattedCoupons,
    });
  } catch (error) {
    console.error("Error while loading available coupons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load available coupons",
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Reset cart values
    const cartTotal = cart.cartTotal;
    const deliveryFee = cartTotal > 1000 ? 0 : 100;
    const totalAmount = cartTotal + deliveryFee;

    const couponId = cart.appliedCoupon;
    await Cart.findOneAndUpdate(
      { userId },
      {
        appliedCoupon: null,
        discountAmount: 0,
        discountedTotal: cartTotal,
      },
      { new: true } // Return updated document
    );

    // Reset session flag
    req.session.couponApplied = false;

    if (couponId) {
      const user = await User.findById(userId);
      if (
        user &&
        user.usedCoupons &&
        user.usedCoupons.includes(couponId.toString())
      ) {
        user.usedCoupons = user.usedCoupons.filter(
          (id) => id !== couponId.toString()
        );
        await user.save();
      }

      const coupon = await Coupon.findById(couponId);
      if (coupon && coupon.usedCount > 0) {
        coupon.usedCount -= 1;
        await coupon.save();
      }
    }

    res.json({
      success: true,
      cartTotal, // Return original cart total
      discountAmount: 0, // No discount after removal
      discountedTotal: cartTotal, // Reset to cartTotal
      totalAmount, // New total with delivery fee
      message: "Coupon removed successfully",
    });
  } catch (error) {
    console.error("Error while removing the coupon:", error);
    res.status(500).json({
      success: false,
      message: "Error removing coupon",
    });
  }
};

module.exports = {
  getCheckoutPage,
  applyCoupon,
  availableCoupons,
  removeCoupon,
};

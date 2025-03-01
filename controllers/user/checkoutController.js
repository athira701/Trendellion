const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const User = require("../../models/userSchema")
const Coupon = require('../../models/couponSchema')


const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user._id; 

        // Fetch the user's addresses and find the default one
        const userAddress = await Address.findOne({ userId });

        let defaultAddress = null;
        if (userAddress && userAddress.address.length > 0) {
            defaultAddress = userAddress.address.find(addr => addr.isDefault === true) || userAddress.address[0];
        }

        // Fetch the user's cart details
        const userCart = await Cart.findOne({ userId });
        console.log("userCart:",userCart)

        let cartItems = [];
        let subtotal = 0;
        let discountAmount = 0;
        let discountedTotal = 0;
        let totalAmount = 0;
        let deliveryFee = 100;
       

        if (userCart && userCart.item.length > 0) {
            cartItems = userCart.item;
            subtotal = userCart.cartTotal;
            
            // Example: Apply a discount of 20% (Modify based on your logic)
            discountAmount = userCart.discountAmount || 0;
            discountedTotal = userCart.discountedTotal || subtotal;

            if (subtotal > 1000) {
                deliveryFee = 0;
            }

            // Calculate total amount (Subtotal - Discount + Delivery Fee)
            totalAmount = discountedTotal + deliveryFee;
        }

        res.render("user/checkout", { 
            defaultAddress,
            cartItems,
            subtotal,
            discountAmount,
            discountedTotal,       
            deliveryFee,
            totalAmount,
            cart: userCart
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
        
        console.log('Received Coupon Code:', couponCode);

        if (!couponCode) {
            return res.status(400).json({ success: false, message: 'No coupon code provided' });
        }

        
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }
        const ourCoupon = couponCode.toUpperCase()
        const coupon = await Coupon.findOne({ couponCode: ourCoupon });
        console.log("Coupon coupon: ",coupon)
        
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid coupon code' });
        }
        if (coupon.status === false) {
            return res.status(400).json({ success: false, message: 'Coupon is inactive' });
        }
        console.log("11111111")

        const currentDate = new Date();
        if (coupon.expiry && new Date(coupon.expiry) < currentDate) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }


        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        console.log("22222")

        // if (user.usedCoupons && Array.isArray(user.usedCoupons)) {
        //     // Check if this coupon is already used by converting everything to uppercase for comparison
        //     const usedCouponCodes = user.usedCoupons.map(coupon => 
        //         typeof coupon === 'string' ? coupon.toUpperCase() : String(coupon).toUpperCase()
        //     );
            
        //     if (usedCouponCodes.includes(couponCode.toUpperCase())) {
        //         return res.json({ success: false, message: 'Coupon already used' });
        //     }
        // } else {
        //     // Initialize usedCoupons if it doesn't exist
        //     user.usedCoupons = [];
        // }
        if (user.usedCoupons && user.usedCoupons.includes(coupon._id.toString())) {
            return res.status(400).json({ success: false, message: 'Coupon already used' });
        }

        console.log("33333")
        
  
       
        let discountAmount = (cart.cartTotal * coupon.discount) / 100;
        cart.appliedCoupon = coupon._id;
        cart.discountAmount = discountAmount;
        cart.discountedTotal = cart.cartTotal - discountAmount;
        await cart.save();
        console.log("44444");


        // if (!user.usedCoupons.includes(coupon._id.toString())) {
        //     user.usedCoupons.push(coupon._id);
        //     await user.save();
        // }
        if (!user.usedCoupons) {
            user.usedCoupons = [];
        }
        user.usedCoupons.push(coupon._id);
        await user.save()

        console.log("55555")

        coupon.usedCount += 1;
        await coupon.save();

        console.log("66666")

        res.json({
            success: true,
            discount: discountAmount,
            newTotal: cart.discountedTotal,
            message: 'Coupon applied successfully'
        });
        console.log("77777")

    } catch (error) {
        console.error('Error applying coupon:', error);
        return res.status(500).json({ success: false,message: 'Error applying coupon' });
    }
};

const availableCoupons = async (req, res) => {
    try {
        const userId = req.session.user._id
        const cart = await Cart.findOne({userId})
        const coupons = await Coupon.find({status: true})
        
       
        const formattedCoupons = coupons.map(coupon => ({
            code: coupon.couponCode,
            description: coupon.description || `${coupon.discount}% off`,
            validUntil: coupon.expiryDate ?  new Date(coupon.expiryDate).toLocaleDateString() : 'No expiry'
        }))
        
  
        res.json({
            success: true,
            coupons: formattedCoupons
        })
    } catch (error) {
        console.log('error while loading available coupons', error)
        res.status(500).json({
            success: false,
            message: 'Failed to load available coupons'
        })
    }
}

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.json({
                success: false,
                message: 'Cart not found'
            });
        }

        //const originalPrice = cart.discountedTotal + cart.discountAmount;
        const originalTotal = cart.cartTotal

        await Cart.findOneAndUpdate(
            { userId: userId },
            { 
                //cartTotal: originalPrice,
                discountedTotal: originalTotal,
                appliedCoupon: null,
                discountAmount: 0
            }
        );

        req.session.appliedCoupon = null;

        res.json({
            success: true,
            //newTotal: originalPrice,
            newTotal: originalTotal,
            message: 'Coupon removed successfully'
        });

    } catch (error) {
        console.log('Error while removing the coupon', error);
        res.json({success: false, message: "Error removing coupon"})
    }
};





module.exports ={
    getCheckoutPage,
    applyCoupon,
    availableCoupons,
    removeCoupon

}
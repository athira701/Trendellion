const Order = require('../../models/orderSchema')
const Cart = require('../../models/cartSchema')
const User=require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema')

const placeOrder = async (req, res) => {
    try {
        const {addressId,  couponCode} = req.body
        const userId = req.session.user._id;
        console.log("USERID:",userId)
        // Validate user session
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        // Get cart and user data
        const cart = await Cart.findOne({ userId }).populate('item.productId');
        const user = await User.findById(userId);
        const userAddress = await Address.findOne({ userId });

        // Validate cart
        if (!cart || !cart.item || cart.item.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty" });
        }

        // Get default address
        const defaultAddress = userAddress.address.find(addr => addr.isDefault === true);
        if (!defaultAddress) {
            return res.status(400).json({ success: false, message: "Please set a default delivery address" });
        }

        // Validate payment method
        const paymentMethod = req.body.paymentMethod?.toUpperCase();
        if (!paymentMethod || !['COD', 'ONLINE'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: "Please select a valid payment method" });
        }

        // Calculate totals and prepare order items
        const orderItems = [];
        for (const item of cart.item) {
            const product = await Product.findById(item.productId);
            if (!product || product.stock < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${item.name}` });
            }

            const orderedItem=cart.item.map((item)=>({
                productId:item.productId._id,
                quantity:item.quantity,
                size:item.size,
                productPrice:item.price,
                totalAmount:item.price*item.quantity
            }))




            for(let item of orderedItem ){
                const {productId,quantity,size}=item
                console.log('items',item)
                console.log(size)
                const product=await Product.findById(productId)

                console.log('profuct finded',product)
           

            if(product){
                const sizeIndex = product.stock.findIndex((s)=>s.size===size);
                console.log('dfijd',sizeIndex)

            

                    
                
            
        
            product.stock[sizeIndex].quantity-=quantity;
            console.log('productstock',product.stock[sizeIndex].quantity)
            product.totalStock-=quantity
            console.log('jfisjdfsdjhdfhdhfjdhdf', product.totalStock)
            await product.save();
    
            
        }
    }
          
          
            
            console.log(product.stock)
           

            orderItems.push({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                size: item.size
            });
        };

        // Calculate delivery fee based on cart total
        const deliveryFee = cart.cartTotal > 1000 ? 0 : 100;
        const totalAmount = cart.cartTotal + deliveryFee;
        const discountAmount = cart.discountAmount

        // Create order
        const order = new Order({
            userId,
            orderedItems: orderItems,
            totalPrice: cart.cartTotal,
            orderAmount: totalAmount - discountAmount,
            totalAmount,
            deliveryFee,
            address: defaultAddress,
            paymentMethod,
            couponCode: couponCode || null,
            paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
            orderStatus: 'PENDING',
            couponDiscount: discountAmount
        });

        await order.save();

        // Clear cart
        cart.item = [];
        cart.cartTotal = 0;
        await cart.save();

        // Redirect based on payment method
        if (paymentMethod === 'ONLINE') {
            req.session.orderId = order.orderId;
            // Implement your payment gateway integration here
            res.json({ success: true, message: "Redirecting to payment gateway",orderId: order.orderId
            });
        } else {
            req.session.orderId = order.orderId;
            res.json({ success: true, message: "Order placed successfully",orderId: order.orderId
            });
        }

    } catch (error) {
        console.log("Order placement error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to place order"});
    }
};

const orderPlacedpage = async (req, res) => {
    try {
        const  orderId  = req.session.orderId;
        console.log("OrderId:",orderId);// or req.params depending on your route setup

        delete req.session.orderId;
        res.render('user/orderPlaced', { orderId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}
const getOrderPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Orders per page
        const searchQuery = req.query.search || '';
        
        const filter = { userId };
        if (searchQuery) {
            filter.orderId = { $regex: searchQuery, $options: 'i' };
        }

        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);
        
        // Fetch orders with populated product details
        const orders = await Order.find(filter)
            .populate({
                path: 'orderedItems.product',
                select: 'name price' // Select the fields you need
            })
            .sort({ createdAt: -1 }) // Most recent orders first
            .skip((page - 1) * limit)
            .limit(limit);
            console.log("Orders:",orders);

        res.render("user/orders", { 
            orders,
            user: req.session.user,
            currentPage: page,
            totalPages,
            searchQuery,
            totalOrders

        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Error loading orders page");
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId; // Assuming the orderId is passed as a URL parameter

        // Fetch the order from the database
        const order = await Order.findOne({ orderId: orderId })
            .populate('userId') // Populate user details if needed
            .populate('orderedItems.product'); // Populate product details

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Prepare the data to be passed to the EJS template
        const orderData = {
            orderId: order.orderId,
            name: order.address.name,
            address: `${order.address.landMark}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}`,
            phone: order.address.phone,
            orderedItems: order.orderedItems.map(item => ({
                productName: item.product.productName, // Assuming the product has a 'name' field
                productImage: item.product.productImage, // Assuming the product has an 'image' field
                size: item.size,
                quantity: item.quantity,
                price: item.price
            })),
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            currentStage: getCurrentStage(order.orderStatus), // Helper function to determine the current stage
            dates: getOrderDates(order) // Helper function to get dates for each stage
        };
        console.log("orderData:",orderData)

        // Render the orderDetails.ejs template with the order data
        res.render('user/orderDetails', { order: orderData });

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getCurrentStage = (orderStatus) => {
    const stages = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    return stages.indexOf(orderStatus);
};

// Helper function to get dates for each stage (this is just a placeholder)
const getOrderDates = (order) => {
    // You can customize this function to return actual dates based on your order tracking logic
    return ['2023-10-01', '2023-10-02', '2023-10-03', '2023-10-04'];
};

const cancelOrderItem = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Find the order
        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if the order can be cancelled
        if (order.orderStatus === 'DELIVERED' || order.orderStatus === 'CANCELLED') {
            return res.status(400).json({ message: 'Order cannot be cancelled' });
        }

        // Update the order status to CANCELLED
        order.orderStatus = 'CANCELLED';
        await order.save();

        // Update the stock quantity for each product in the order
        for (const item of order.orderedItems) {
            const product = await Product.findById(item.product);
            if (product) {
                // Find the stock entry for the specific size
                const stockEntry = product.stock.find(stock => stock.size === item.size);
                if (stockEntry) {
                    stockEntry.quantity += item.quantity; // Add back the cancelled quantity
                    product.totalStock += item.quantity; // Update total stock
                    await product.save();
                }
            }
        }

        res.status(200).json({ message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


module.exports = {
    placeOrder,
    orderPlacedpage,
    getOrderPage,
    getOrderDetails,
    cancelOrderItem
}
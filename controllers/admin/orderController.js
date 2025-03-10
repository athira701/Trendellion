const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')
const Order=require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema')


const loadOrder = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const currentPage = parseInt(page, 10);
        const limitValue = parseInt(limit, 10);

        const orders = await Order.find({})
            .populate('userId', 'name email')
            .populate('orderedItems.product', 'productName productImage')
            .sort({ createdAt: -1 })
            .limit(limitValue)
            .skip((currentPage - 1) * limitValue);

        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limitValue);

        res.render('admin/orderPage', {
            orders,
            totalPages,
            currentPage,
            limit: limitValue
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
};

const singleOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log("Order ID:", orderId);
        
        const orderDetails = await Order.findById(orderId)
            .populate('userId', 'name email mobile') 
            .populate('orderedItems.product', 'productName productImage price'); // Corrected path

        console.log("Order Details:", orderDetails);

        if (!orderDetails) {
            return res.status(404).send('Order not found');
        }

        res.render('admin/singleOrder', { orderDetails });
    } catch (error) {
        console.error('Error loading order details:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const getCancelledOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Only find orders with CANCELLED status
        const totalOrders = await Order.countDocuments({ orderStatus: 'CANCELLED' });
        const orders = await Order.find({ orderStatus: 'CANCELLED' })
            .populate('userId')
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const totalPages = Math.ceil(totalOrders / limit);
        
        res.render('admin/cancelledOrders', {
            orders,
            currentPage: page,
            totalPages,
            limit
        });
    } catch (error) {
        console.error('Error fetching cancelled orders:', error);
        res.status(500).render('error', { message: 'Failed to load cancelled orders.' });
    }
};
const getReturnRequestedOrderPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Only find orders with CANCELLED status
        const totalOrders = await Order.countDocuments({ orderStatus: 'RETURN REQUESTED' });
        const orders = await Order.find({ orderStatus: 'RETURN REQUESTED' })
            .populate('userId')
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const totalPages = Math.ceil(totalOrders / limit);
        
        res.render('admin/returnRequestedOrders', {
            orders,
            currentPage: page,
            totalPages,
            limit
        });
    } catch (error) {
        console.error('Error fetching cancelled orders:', error);
        res.status(500).render('error', { message: 'Failed to load cancelled orders.' });
    }
}


const approveReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const order = await Order.findById(orderId).populate('orderedItems.product userId');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if the order is in RETURN REQUESTED state
        if (order.orderStatus !== 'RETURN REQUESTED') {
            return res.status(400).json({ message: 'Invalid return request state' });
        }

        // Update stock when return is approved
        for (const item of order.orderedItems) {
            const product = item.product; // Already populated
            if (product) {
                const stockEntry = product.stock.find(stock => stock.size === item.size);
                if (stockEntry) {
                    stockEntry.quantity += item.quantity;
                    product.totalStock += item.quantity;
                    await product.save();
                }
            }
        }

        // Update order status to RETURN CONFIRMED
        order.orderStatus = 'RETURN CONFIRMED';
        
        // Process refund to wallet
        if (order.paymentMethod === 'ONLINE' || order.paymentMethod === 'Wallet' || order.paymentMethod === 'COD') {
            // Find or create wallet for the user
            let wallet = await Wallet.findOne({ userId: order.userId._id });
            
            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId._id,
                    balance: 0,
                    transactions: []
                });
            }
            
            // Add the refund amount to wallet balance
            wallet.balance += order.totalAmount;
            
            // Create a new transaction record
            wallet.transactions.push({
                amount: order.totalAmount,
                transactionsMethod: 'REFUND',
                date: new Date(),
                orderId: order._id,
                status: 'completed'
            });
            
            // Save wallet updates
            await wallet.save();
            
            // Update payment status
            order.paymentStatus = 'REFUNDED';
        }

        await order.save();

        // Return JSON response
        return res.status(200).json({ 
            success: true, 
            message: 'Return request approved successfully!'
        });
    } catch (error) {
        console.error('Error approving return:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to approve return request',
            error: error.message
        });
    }
};

const changeStatus = async (req, res) => {
    console.log("Incoming request to update order status");

    const { orderId, status } = req.body;
    console.log("Received Data -> Order ID:", orderId, "Status:", status);

    if (!orderId || !status) {
        return res.status(400).json({ error: "Order ID and status are required" });
    }

    try {
        // Find and update the order using orderId
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { orderStatus: status },
            { new: true }
        );

        if (!updatedOrder) {
            console.log("Order not found for ID:", orderId);
            return res.status(404).json({ error: "Order not found" });
        }

        console.log("Order updated successfully:", updatedOrder);
        return res.status(200).json({
            message: "Order status updated successfully",
            updatedOrder,
        });

    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};


module.exports = {
    loadOrder,
    singleOrder,
    getCancelledOrders,
    getReturnRequestedOrderPage,
    approveReturn,
    changeStatus,
    
}
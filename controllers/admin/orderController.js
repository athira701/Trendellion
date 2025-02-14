const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')
const Order=require('../../models/orderSchema')


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
    changeStatus
}
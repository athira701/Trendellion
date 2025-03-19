const User = require('../../models/userSchema')
const mongoose = require('mongoose')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const bcrypt = require('bcrypt')



const pageerror = async(req,res)=>{
    res.render("admin/adminerror")
}


const loadLogin = async (req,res) =>{

   try {
    if(req.session.admin){
       return res.render('admin/dashboard')
    }
    res.render('admin/adminLogin')
   } catch (error) {
    
   }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.redirect('/admin/login?error=All fields are required');
        }

        // Find admin user
        const admin = await User.findOne({ email: email, isAdmin: true });

        if (!admin) {
            return res.redirect('/admin/login?error=Invalid username or password');
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.redirect('/admin/login?error=Invalid username or password');
        }

        // Set session
        req.session.admin = {
            id: admin._id,
            email: admin.email
        };

        return res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Login error:', error);
        return res.redirect('/admin/login?error=Something went wrong. Try again.');
    }
};


const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        console.log("Starting dashboard data fetch...");
        const orderStatusCheck = await Order.distinct("orderStatus");
        console.log("Order statuses in database:", orderStatusCheck);

        // Get total revenue, profit, and refunds
        const orderStats = await Order.aggregate([
            {
                $facet: {
                    "revenue": [
                        { $match: { orderStatus: { $in: ["Delivered", "Shipped"] } } },
                        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                    ],
                    "pendingRevenue": [
                        { $match: { orderStatus: { $in: ["PENDING", "PROCESSING"] } } },
                        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                    ],
                    "refunds": [
                        { $match: { paymentStatus: "REFUNDED" } },
                        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                    ],
                    "orderCounts": [
                        { $group: { 
                            _id: "$orderStatus", 
                            count: { $sum: 1 } 
                        } }
                    ],
                    "paymentMethods": [
                        { $group: { 
                            _id: "$paymentMethod", 
                            count: { $sum: 1 },
                            revenue: { $sum: "$totalAmount" }
                        } }
                    ]
                }
            }
        ]);

        console.log("Raw orderStats:", JSON.stringify(orderStats, null, 2));

        // Format the order stats
        const totalRevenue = orderStats[0].revenue[0]?.total || 0;
        const pendingRevenue = orderStats[0].pendingRevenue[0]?.total || 0;
        const totalRefunds = orderStats[0].refunds[0]?.total || 0;

        console.log("Revenue breakdown - Total:", totalRevenue, "Pending:", pendingRevenue);
        
        // Format order counts by status
        const orderCounts = {};
        orderStats[0].orderCounts.forEach(item => {
            orderCounts[item._id] = item.count;
        });

        // Format payment methods
        const paymentMethods = {};
        orderStats[0].paymentMethods.forEach(item => {
            paymentMethods[item._id] = {
                count: item.count,
                revenue: item.revenue
            };
        });

        // Get total orders and products
        const totalOrders = await Order.countDocuments();
        const totalProducts = await Product.countDocuments();
        const activeProducts = await Product.countDocuments({ isActive: true });

        // Get monthly order data for the current year
        const currentYear = new Date().getFullYear();
        const monthlyOrderData = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { 
                        $gte: new Date(currentYear, 0, 1),
                        $lte: new Date(currentYear, 11, 31)
                    }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" } },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalAmount" },
                    avgOrderValue: { $avg: "$totalAmount" }
                }
            },
            { $sort: { "_id.month": 1 } }
        ]);

        // Format monthly data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedMonthlyData = {
            labels: monthNames,
            orders: new Array(12).fill(0),
            revenue: new Array(12).fill(0),
            avgOrderValue: new Array(12).fill(0)
        };

        monthlyOrderData.forEach(item => {
            const monthIndex = item._id.month - 1;
            formattedMonthlyData.orders[monthIndex] = item.orders;
            formattedMonthlyData.revenue[monthIndex] = item.revenue;
            formattedMonthlyData.avgOrderValue[monthIndex] = parseFloat(item.avgOrderValue.toFixed(2));
        });

        // Get top products by sales
        const topProducts = await Order.aggregate([
            { $unwind: "$orderedItems" },
            { $match: { orderStatus: { $in: ["DELIVERED", "Shipped"] } } },
            {
                $group: {
                    _id: "$orderedItems.product",
                    totalSales: { $sum: "$orderedItems.quantity" },
                    revenue: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $project: {
                    productName: { $arrayElemAt: ["$productDetails.productName", 0] },
                    totalSales: 1,
                    revenue: 1
                }
            }
        ]);

        // Get recent orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'username email')
            .select('orderId totalAmount paymentMethod orderStatus createdAt');

        // Get payment method distribution
        const paymentMethodDistribution = await Order.aggregate([
            {
                $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 }
                }
            }
        ]);

        const formattedPaymentMethodData = {
            labels: paymentMethodDistribution.map(item => item._id),
            values: paymentMethodDistribution.map(item => item.count)
        };

        // Prepare dashboard data
        const dashboardData = {
            totalRevenue,
            pendingRevenue,
            totalRefunds,
            totalOrders,
            totalProducts,
            activeProducts,
            orderCounts,
            paymentMethods,
            monthlyData: formattedMonthlyData,
            topProducts,
            recentOrders,
            paymentMethodData: formattedPaymentMethodData
        };

        console.log("Final dashboard data:", dashboardData);

        // Return as JSON if requested
        if (req.xhr || req.headers.accept.includes('application/json')) {
            console.log("Sending JSON response");
            return res.json(dashboardData);
        }

        // Render the dashboard
        console.log("Rendering dashboard template");
        return res.render('admin/dashboard', {
            ...dashboardData,
            admin: req.session.admin,
            active: 'dashboard'
        });

    } catch (error) {
        console.error("Error in loadDashboard:", error);
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ 
                error: "Server error", 
                details: error.message 
            });
        }
        res.status(500).render('error', { error: "An error occurred loading the dashboard" });
    }
};

const logout = async (req,res) =>{
    try {
        req.session.destroy(err =>{
            if(err){
                console.log("Error destroying Session",err)
                return res.redirect("/adminerror")   
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("Unexpected error during logout",error)
        res.redirect("/pageerror")
        
    }
}




module.exports ={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}
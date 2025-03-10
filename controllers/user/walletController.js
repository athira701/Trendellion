const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema')

const getWalletPage = async (req,res) =>{
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.redirect('/login');
        }

     
        const user = await User.findById(userId);
        
        let wallet = await Wallet.findOne({ userId });

        const walletBalance = wallet ? wallet.balance : 0;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5; 
        const skip = (page - 1) * limit;

     
        const transactions = wallet ? wallet.transactions.slice().reverse().slice(skip, skip + limit) : []; 

       
        const totalTransactions = wallet ? wallet.transactions.length : 0; 
        const totalPages = Math.ceil(totalTransactions / limit); 

        res.render('user/wallet', {
            user,
            walletBalance,
            transactions,
            currentPage: page,
            totalPages,
            message: null 
        });
    } catch (error) {
        console.error('Error while rendering wallet:', error);
        res.status(500).send('Internal server error');
    }
}

const createWallet = async(req,res) =>{
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        let wallet = await Wallet.findOne({ userId });
        if (wallet) {
            return res.status(400).json({
                success: false,
                message: 'Wallet already exists'
            });
        }

        wallet = new Wallet({
            userId,
            balance: 0,
            transactions: []
        });

        await wallet.save();

        res.status(200).json({
            success: true,
            message: 'Wallet created successfully'
        });
    } catch (error) {
        console.error('Error creating wallet:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }

}

const addMoney = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }
        if (amount > 10000) {
            return res.status(400).json({ message: '₹10,000 is the one-time limit' });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.status(400).json({ message: 'Wallet not found' });
        }

        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt: `wallet_${Date.now()}`,
            payment_capture: 1,
        };

        const order = await razorpayInstance.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error while adding money:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
        const userId = req.session.user._id;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
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
            status: 'completed'
        };

        wallet.balance += parsedAmount;
        wallet.transactions.push(newTransaction);
        await wallet.save();

        res.json({ 
            message: "Money added successfully!", 
            newBalance: wallet.balance 
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ message: "Payment verification failed" });
    }
};

const processWalletPayment = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { orderId, amount } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.status(400).json({ message: 'Wallet not found' });
        }

        if (wallet.balance < amount) {
            return res.status(400).json({ message: 'Insufficient wallet balance' });
        }

      
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

       
        wallet.balance -= amount;
        
      
        const newTransaction = {
            amount: -amount, 
            transactionsMethod: "Order Payment",
            date: new Date(),
            orderId: orderId,
            status: 'completed'
        };

        wallet.transactions.push(newTransaction);
        await wallet.save();

     
        order.paymentStatus = 'completed';
        order.paymentMethod = 'Wallet';
        await order.save();

        res.status(200).json({
            success: true,
            message: 'Payment processed successfully',
            newBalance: wallet.balance
        });
    } catch (error) {
        console.error('Error processing wallet payment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};





module.exports = {
    getWalletPage,
    createWallet,
    addMoney,
    verifyPayment,
    processWalletPayment

}
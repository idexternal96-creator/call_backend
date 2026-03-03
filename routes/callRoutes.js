const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const User = require('../models/User');

// ── Twilio setup ──────────────────────────────────────────────────────────────
// Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE in .env
// If not configured, SMS is logged to console (mock mode)
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE;     // e.g. +1415XXXXXXX

let twilioClient = null;
if (TWILIO_SID && TWILIO_TOKEN) {
    twilioClient = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
    console.log('[SMS] Twilio client initialized ✅');
} else {
    console.log('[SMS] Twilio not configured — running in mock mode 📵');
}

/**
 * Send SMS — uses Twilio if configured, otherwise logs to console.
 * @param {string} to   - recipient phone number (E.164 format: +91XXXXXXXXXX)
 * @param {string} body - message text
 */
async function sendSms(to, body) {
    if (twilioClient && TWILIO_FROM) {
        try {
            const msg = await twilioClient.messages.create({ to, from: TWILIO_FROM, body });
            console.log(`[SMS] Sent to ${to} — SID: ${msg.sid}`);
            return true;
        } catch (err) {
            console.error(`[SMS] Twilio error: ${err.message}`);
            return false;
        }
    } else {
        // Mock mode
        console.log(`\n[SMS MOCK] ─────────────────────────────`);
        console.log(`[SMS MOCK] To:      ${to}`);
        console.log(`[SMS MOCK] Message: ${body}`);
        console.log(`[SMS MOCK] ─────────────────────────────\n`);
        return true;
    }
}

// ── POST /api/calls  — Log an incoming call ───────────────────────────────────
//
//  Body: { receivingNumber, incomingNumber, userId? }
//
//  Logic:
//   • Find existing CallLog for this (receivingNumber, incomingNumber) pair
//   • If found  → push timestamp + increment count (upsert)
//   • If not    → create new document (count = 1)
//   • Send SMS to the incomingNumber (caller) automatically
//
router.post('/', async (req, res) => {
    try {
        const { receivingNumber, incomingNumber, userId } = req.body;

        if (!receivingNumber || !incomingNumber) {
            return res.status(400).json({
                message: 'receivingNumber and incomingNumber are required',
            });
        }

        const now = new Date();

        // Upsert: find existing doc and update, or create new one
        const callLog = await CallLog.findOneAndUpdate(
            { receivingNumber, incomingNumber },
            {
                $inc: { count: 1 },
                $push: {
                    timestamps: {
                        $each: [now],
                        $slice: -200,   // keep only last 200 timestamps
                    },
                },
                $setOnInsert: {
                    userId: userId || null,
                    receivingNumber,
                    incomingNumber,
                    smsSent: false,
                },
            },
            { upsert: true, new: true }
        );

        // Build SMS message
        const smsBody =
            `📵 Your call to ${receivingNumber} was auto-rejected.\n` +
            `This number uses Call AutoTerminate.\n` +
            `Call #${callLog.count} — ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

        // Send SMS to the caller (incomingNumber)
        const smsSent = await sendSms(incomingNumber, smsBody);

        // Update smsSent flag
        if (smsSent) {
            await CallLog.updateOne(
                { _id: callLog._id },
                { $set: { smsSent: true } }
            );
        }

        res.status(201).json({
            message: 'Call logged' + (smsSent ? ' and SMS sent' : ' (SMS failed)'),
            callLog: {
                id: callLog._id,
                receivingNumber: callLog.receivingNumber,
                incomingNumber: callLog.incomingNumber,
                count: callLog.count,
                latestTimestamp: now,
                smsSent,
            },
        });
    } catch (err) {
        console.error(`[callRoutes] Error: ${err.message}`);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── GET /api/calls  — List all call logs ─────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { receivingNumber, limit = 50, startDate, endDate } = req.query;

        const filter = {};
        if (receivingNumber) filter.receivingNumber = receivingNumber;

        // Apply date filtering to the most recent call (updatedAt)
        if (startDate || endDate) {
            filter.updatedAt = {};
            if (startDate) filter.updatedAt.$gte = new Date(startDate);
            if (endDate) filter.updatedAt.$lte = new Date(endDate);
        }

        const logs = await CallLog
            .find(filter)          // Include the full timestamps array
            .sort({ updatedAt: -1 })
            .limit(Number(limit))
            .lean();               // For easier manipulation

        // Manually look up User serviceNames based on receivingNumber
        // (since userId might be null from older clients backing up logs)
        const enrichedLogs = await Promise.all(logs.map(async (log) => {
            let serviceName = null;
            if (log.receivingNumber) {
                const user = await User.findOne({ phoneNumber: log.receivingNumber }).select('serviceName').lean();
                if (user) serviceName = user.serviceName;
            }
            return {
                ...log,
                serviceName: serviceName || 'Unknown Service',
            };
        }));

        res.json(enrichedLogs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/calls/:id  — Full detail including timestamps ───────────────────
router.get('/:id', async (req, res) => {
    try {
        const log = await CallLog.findById(req.params.id);
        if (!log) return res.status(404).json({ message: 'Call log not found' });
        res.json(log);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET /api/calls/by/:receivingNumber  — All calls for one number ────────────
router.get('/by/:receivingNumber', async (req, res) => {
    try {
        const logs = await CallLog
            .find({ receivingNumber: req.params.receivingNumber })
            .sort({ count: -1 });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

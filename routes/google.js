var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {oauth2Client, google} = require('../config/oauth');


// Google Calendar API setup
const calendar = google.calendar({version: 'v3', auth: oauth2Client});

// Function to load saved token
async function getSavedToken() {
    try {
        const tokenPath = path.join(__dirname, '..', 'token.json');
        if (!await fs.existsSync(tokenPath)) {
            console.error('Token file not found at:', tokenPath);
            return null;
        }

        const token = await fs.readFileSync(tokenPath);
        return JSON.parse(token);
    } catch (error) {
        console.error('Error loading the token file', error);
        return null;
    }
}

router.get('/auth', function (req, res, next) {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'online',
        scope: ['https://www.googleapis.com/auth/calendar'],
    });
    res.redirect(url);
});


router.get('/auth/callback', async function (req, res, next) {
    try {
        const {tokens} = await oauth2Client.getToken(req.query.code);
        oauth2Client.setCredentials(tokens);

        // Save the token
        await fs.writeFile(path.join(__dirname, '..', 'token.json'), JSON.stringify(tokens), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', 'token.json');
        });

        res.redirect('/google/create-meet');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).send('Authentication failed!');
    }
});


router.get('/create-meet', async function (req, res, next) {
    try {
        console.log('Creating a Google Meet event');
        const event = {
            summary: 'Google Meet Event',
            description: 'A meeting created from Node.js',
            start: {
                dateTime: '2023-01-01T09:00:00-07:00', // Replace with actual date and time
                timeZone: 'America/Los_Angeles',
            },
            end: {
                dateTime: '2023-01-01T10:00:00-07:00', // Replace with actual date and time
                timeZone: 'America/Los_Angeles',
            },
            conferenceData: {
                createRequest: {requestId: "sample123", conferenceSolutionKey: {type: "hangoutsMeet"}}
            },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            conferenceDataVersion: 1,
        });

        res.send(response.data);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

router.post('/meet', async function (req, res, next) {
    try {
        console.log('Creating a Google Meet event');
        console.log(req.body);
        console.log("=====================================");
        const {summary, description, start, end, recurrence, attendees, reminders, conferenceData} = req.body;

        const savedToken = await getSavedToken();
        if (!savedToken) {
            return res.status(401).send('No saved token found, please authenticate first');
        }
        oauth2Client.setCredentials(savedToken);


        const event = {
            summary: summary,
            description: description,
            start: {
                dateTime: new Date(start.dateTime), // Replace with actual date and time
                timeZone: start.timeZone,
            },
            end: {
                dateTime: new Date(end.dateTime), // Replace with actual date and time
                timeZone: end.timeZone,
            },
            recurrence: recurrence,
            attendees: attendees,
            reminders: {
                useDefault: reminders.useDefault,
                overrides: reminders.overrides
            },
            conferenceData: {
                createRequest: conferenceData.createRequest
            },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            conferenceDataVersion: 1,
        });

        res.send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

router.get('/meeting', async function (req, res, next) {
    try {
        console.log('Creating a Google Meet event');

        const savedToken = await getSavedToken();
        if (!savedToken) {
            return res.status(401).send('No saved token found, please authenticate first');
        }
        oauth2Client.setCredentials(savedToken);


        const event = {
            summary: 'Google Meet',
            description: 'New meeting created',
            start: {
                dateTime: '2023-11-30T18:00:00-07:00', // Replace with actual date and time
                timeZone: 'America/Los_Angeles',
            },
            end: {
                dateTime: '2023-11-30T19:00:00-07:00', // Replace with actual date and time
                timeZone: 'America/Los_Angeles',
            },
            recurrence: [
                'RRULE:FREQ=DAILY;COUNT=2'
            ],
            attendees: [
                {email: 'vinukamillenniumit@gmail.com'},
            ],
            conferenceData: {
                createRequest: {requestId: "sample123", conferenceSolutionKey: {type: "hangoutsMeet"}}
            },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            conferenceDataVersion: 1,
        });

        res.send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

module.exports = router;

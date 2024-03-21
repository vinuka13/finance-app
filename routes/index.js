var express = require('express');
var axios = require('axios');
const {json} = require("express");
var router = express.Router();

router.post('/', async function (req, res, next) {
    try {
        console.log('Request body:');
        console.log(req.body);
        const url = req.body.url;
        const headers = req.body.header;
        const method = req.body.method;
        const data = req.body.data;
        var response = null;

        if (!url) {
            return res.status(400).json({error: 'URL is required'});
        }

        if (!method) {
            return res.status(400).json({error: 'Method is required'});
        }

        if (method === 'POST') {
            response = await axios.post(url, data, {
                headers: headers,
            });
        }

        if (method === 'GET') {
            response = await axios.get(url, {
                headers: headers,
            });
        }

        if (method === 'PUT') {
            response = await axios.put(url, data, {
                headers: headers,
            });
        }

        if (method === 'DELETE') {
            response = await axios.delete(url, {
                headers: headers,
            });
        }
        const responseData = response.data;

        res.json(responseData);
    } catch (error) {
        console.error('Error sending data to third-party API:', error);
        res.status(500).json(error);
    }
});

router.post('/send', async function (req, res, next) {
    try {
        console.log('Request body:');
        console.log(req.body);
        let jsonObj = JSON.parse(req.body);
        console.log(jsonObj)
        const url = jsonObj.url;
        const headers = jsonObj.header;
        const method = jsonObj.method;
        const data = jsonObj.data;
        var response = null;

        if (!url) {
            return res.status(400).json({error: 'URL is required'});
        }

        if (!method) {
            return res.status(400).json({error: 'Method is required'});
        }

        if (method === 'POST') {
            response = await axios.post(url, data, {
                headers: headers,
            });
        }

        if (method === 'GET') {
            response = await axios.get(url, {
                headers: headers,
            });
        }

        if (method === 'PUT') {
            response = await axios.put(url, data, {
                headers: headers,
            });
        }

        if (method === 'DELETE') {
            response = await axios.delete(url, {
                headers: headers,
            });
        }
        const responseData = response.data;

        res.json(responseData);
    } catch (error) {
        console.error('Error sending data to third-party API:', error);
        res.status(500).json(error);
    }
});

router.get('/', async function (req, res, next) {
    res.json("Hello World");
});

module.exports = router;

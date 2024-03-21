const express = require('express');
const axios = require('axios');
var router = express.Router();
 
router.patch('/', async (req, res) => {
    const username = 'Automation_Team';
    const password = 'MIT@1234';
    const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
 
    const apiEndpoint = 'https://ehpw-test.fa.ap1.oraclecloud.com/fscmRestApi/resources/11.13.18.05/invoices/1374062/child/invoiceDff/1374062';
 
    try {
        const response = await axios.patch(apiEndpoint, req.body, {
            headers: {
                'Authorization': `Basic ${token}`
            }
        });
        res.send(response.data);
    } catch (error) {
        res.status(500).send('Error occurred: ' + error.message);
    }
});
 
// const port = 3000;
// app.listen(port, () => {
//     console.log(`Server running on http://localhost:${port}`);
// });

module.exports = router;
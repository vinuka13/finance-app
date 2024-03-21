var express = require('express');
var axios = require('axios');
const {json} = require("express");
const fs = require('fs');
let ejs = require('ejs');
let path = require('path');
var convert = require('xml-js');
const nodemailer = require('nodemailer');
let pdf = require('html-pdf');
var xml2js = require('xml2js');
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");
var router = express.Router();
const postmark = require('postmark');

router.post('/', async function (req, res, next) {
    try {
        console.log('Request body:');

        let name = req.query.name;
        let service = req.query.service;
        let serviceUrl = null;
        let xmlName = null;

        switch (service) {
            case 'invoice':
                serviceUrl = '/Custom/MIT/Common/Webservices/Invoices.xdo';
                xmlName = 'INVOICE_NUM';
                break;
            case 'grn':
                serviceUrl = '/Custom/MIT/Common/Webservices/PO.xdo';
                xmlName = 'PO_NO';
                break;
            case 'vendor':
                serviceUrl = '/Custom/MIT/Common/Webservices/Vendor.xdo';
                xmlName = 'VENDOR_NAME';
                break;
            default:
                throw new Exception('Invalid service');

        }

        const url = 'https://ehpw-test.fa.ap1.oraclecloud.com:443/xmlpserver/services/ExternalReportWSSService';
        var response = null;

        let xmls = '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">\n' +
            '    <soap:Header/>\n' +
            '    <soap:Body>\n' +
            '        <pub:runReport>\n' +
            '            <pub:reportRequest>\n' +
            '                <pub:attributeFormat></pub:attributeFormat>\n' +
            '                <pub:flattenXML></pub:flattenXML>\n' +
            '                <pub:parameterNameValues>\n' +
            '                    <pub:item>\n' +
            '                        <pub:name></pub:name>\n' +
            '                        <pub:values>\n' +
            '                            <pub:item></pub:item>\n' +
            '                        </pub:values>\n' +
            '                    </pub:item>\n' +
            '                </pub:parameterNameValues>\n' +
            '                <pub:reportAbsolutePath>'+serviceUrl+'</pub:reportAbsolutePath>\n' +
            '                <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>\n' +
            '            </pub:reportRequest>\n' +
            '        </pub:runReport>\n' +
            '    </soap:Body>\n' +
            '</soap:Envelope>';

        response = await axios.post(url, xmls, {
            headers: {'Content-Type': 'application/soap+xml; charset=utf-8'},
            auth: {
                username: 'Automation_Team',
                password: 'MIT@1234'
            }
        });

        const responseData = response.data;

        const parser = new XMLParser();
        const parsedResponse = parser.parse(responseData); // parse body xml

        let element = parsedResponse['env:Envelope']['env:Body']['ns2:runReportResponse']['ns2:runReportReturn']['ns2:reportBytes'];

        let resp = Buffer.from(element, "base64").toString("utf-8");
        let result = parser.parse(resp);
        result = result['DATA_DS']['G_1'];

        for (const resultKey in result) {
            if (result.hasOwnProperty(resultKey)) {
                const resultElement = result[resultKey];
                if (resultElement[xmlName] === name) {
                    result = resultElement;
                    break;
                }
            }
        }

        console.log(result);
        res.json(result);
    } catch (error) {
        console.error('Error sending data to third-party API:', error);
        res.status(500).json(error);
    }
});

// router.get('/call-soap/:poNumber', async (req, res) => {
//     try {
//         const poNumber = req.params.poNumber;
//         const response = await callSoapEndpoint(poNumber);
//         const jsonResponse = await convertToJSON(response);
//         res.json(jsonResponse);
//     } catch (error) {
//         res.status(500).send(error.toString());
//     }
// });

// async function callSoapEndpoint(poNumber) {
//     const soapBody = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">
//     <soap:Header/>
//     <soap:Body>
//     <pub:runReport>
//     <pub:reportRequest>
//     <pub:attributeFormat></pub:attributeFormat>
//     <pub:flattenXML></pub:flattenXML>
//     <pub:parameterNameValues>
//     <pub:item>
//     <pub:name>PO_NUMBER</pub:name>
//     <pub:values>
//     <pub:item>${poNumber}</pub:item>
//     </pub:values>
//     </pub:item>
//     </pub:parameterNameValues>
//     <pub:reportAbsolutePath>/Custom/MIT/Common/Webservices/PO.xdo</pub:reportAbsolutePath>
//     <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>
//     </pub:reportRequest>
//     </pub:runReport>
//     </soap:Body>
//     </soap:Envelope>`;

//     const username = 'Automation_Team';
//     const password = 'MIT@1234';
//     const basicAuth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

//     try {
//         const response = await axios.post('https://ehpw-test.fa.ap1.oraclecloud.com:443/xmlpserver/services/ExternalReportWSSService', soapBody, {
//             headers: {
//                 'Content-Type': 'application/soap+xml',
//                 'Authorization': basicAuth
//             }
//         });
//         return response.data;
//     } catch (error) {
//         throw new Error('Error in SOAP request: ' + error.message);
//     }

// }

router.get('/call-po/:poNumber', async (req, res) => {
    try {
        const poNumber = req.params.poNumber;
        const response = await callSoapEndpointPO(poNumber);
        const jsonResponse = await convertToJSONPO(response);
        console.log(jsonResponse);
        console.log(jsonResponse[0].VENDOR_NAME);
        res.json(jsonResponse);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});


router.get('/call-so/:soNumber', async (req, res) => {
    try {
        const soNumber = req.params.soNumber;
        const response = await callSoapEndpointSO(soNumber);
        const jsonResponse = await convertToJSONSO(response);
        console.log(jsonResponse[0].CUSTOMER_NAME);
        res.json(jsonResponse);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

router.get('/checkSellingRate/:toCurrency/:fromCurrency/:type/:conversionDate', async (req, res) => {
    try {
        const toCurrency = req.params.toCurrency;
        const fromCurrency = req.params.fromCurrency;
        const type = req.params.type;
        const conversionDate = req.params.conversionDate;
//      console.log(conversionDate);
        const response = await getSellingRate(toCurrency, fromCurrency, type, conversionDate);
        const jsonResponse = await convertToJSONRate(response);
//      console.log("json response - " + jsonResponse);
        res.json(jsonResponse);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

router.post('/call-invoice/updateInvoice', (req, res) => {
    const { invoiceNumber, ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, ATTRIBUTE4} = req.body;
    sendSoapRequest(invoiceNumber,ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, ATTRIBUTE4,  res);
});

router.post("/sampath", (req, res) => {
    console.log("sampath in");
    const { contactname, type, amemdment, date, margin, amount, expire, tenderNo} = req.body;
    ejs.renderFile(
        path.join(__dirname, "../views", "report-template.ejs"),
        console.log("ejs template accessed"),
        {
            contactname : contactname,
            type : type,
            amemdment : amemdment,
            date : date,
            margin : margin,
            amount : amount,
            expire : expire,
            tenderNo : tenderNo
        },
        (err, data) => {
            if(err) {
                res.send(err)
            } else {
                let options = {
                    height: "11.50in",
                    width: "8.5in",
                    header : {
                        height: "20mn"
                    },
                    footer : {
                        height: "20mn"
                    }
                }
                pdf.create(data, options).toFile("sampath.pdf", function (err, data){
                    if(err) {
                        res.send(err);
                    } else {
                        console.log("sampath pdf made");
                        // res.send("file created");
                        // const nodemailer = require('nodemailer')
                        // let mailTranporter = nodemailer.createTransport({
                        //     host: 'mail.tempovibesl.com',
                        //     port: 465,
                        //     secure: true,
                        //     auth : {
                        //         user : 'contact@tempovibesl.com',
                        //         pass : 'Temp#123@SL'
                        //     }
                        // });
                        // let maildetails = {
                        //     from : 'contact@tempovibesl.com',
                        //     to : 'vinukap@mitesp.com',
                        //     subject : 'finance app',
                        //     text : 'test email',
                        //     attachments: [ // Corrected typo here
                        //         {
                        //             path: data.filename
                        //         }
                        //     ]
                        // };
                        // mailTranporter.sendMail(maildetails, function (err, data) {
                        //     if(err) {
                        //         console.log(err);
                        //     } else {
                        //         console.log(maildetails);
                        //         res.send("email sent")
                        //     }
                        // });

                    const filePath = path.join(__dirname, 'sampath.pdf'); // Example for a PDF file

                    // Read the file and convert it to base64
                    const fileContent = fs.readFileSync(filePath);
                    const fileContentBase64 = fileContent.toString('base64');

                    const postData = {
                        "From": "vinukap@mitesp.com",
                        "To": "jayanw@mitesp.com",
                        "Subject": "Postmark test",
                        "TextBody": "Hello dear Postmark user.",
                        "HtmlBody": "<html><body><strong>Hello</strong> dear Postmark user.</body></html>",
                        "Attachments": [
                          {
                            "Name": "report.pdf",
                            "Content": fileContentBase64, // Your base64 encoded file content
                            "ContentType": "application/octet-stream"
                          }
                        ]
                      };
                      
                      axios.post('https://api.postmarkapp.com/email', postData, {
                        headers: {
                          "Accept": "application/json",
                          "Content-Type": "application/json",
                          "X-Postmark-Server-Token": "02f5c3dd-daaf-42e1-b852-6837882d8627" // Replace this with your actual server token
                        }
                      })
                      .then((response) => {
                        res.send('Email sent successfully:')
                        console.log('Email sent successfully:', response.data);
                      })
                      .catch((error) => {
                        res.send('Failed to send email:')
                        console.error('Failed to send email:', error.response.data);
                      });
                    
                    }
                })
            }
        }
    )
})


const sendSoapRequest = async (invoiceNumber, ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, ATTRIBUTE4, res, attempt = 1 ) => {
    try {

        // Construct SOAP request body
        const soapRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://xmlns.oracle.com/apps/financials/commonModules/shared/model/erpIntegrationService/types/" 
        xmlns:erp="http://xmlns.oracle.com/apps/financials/commonModules/shared/model/erpIntegrationService/">
        <soapenv:Header/>
        <soapenv:Body>
        <typ:updateDffEntityDetails>
        <!--Optional:-->
        <typ:document>
        <erp:Content>cid:1113592950010</erp:Content>
        <erp:FileName>#NULL</erp:FileName>
        <!--Optional:-->
        <erp:ContentType>#NULL</erp:ContentType>
        <!--Optional:-->
        <erp:DocumentTitle>#NULL</erp:DocumentTitle>
        <!--Optional:-->
        <erp:DocumentAuthor>#NULL</erp:DocumentAuthor>
        <!--Optional:-->
        <erp:DocumentSecurityGroup>#NULL</erp:DocumentSecurityGroup>
        <!--Optional:-->
        <erp:DocumentAccount>#NULL</erp:DocumentAccount>
        <!--Optional:-->
        <erp:DocumentName>#NULL</erp:DocumentName>
        <!--Optional:-->
        <erp:DocumentId>#NULL</erp:DocumentId>
        </typ:document>
        <!--Optional:-->
        <typ:operationMode>#NULL</typ:operationMode>
        <!--Optional:-->
        <typ:object>
        <!--Optional:-->
        <erp:EntityName>Payables Invoice</erp:EntityName>
        <!--Optional:-->
        <erp:ContextValue>#NULL</erp:ContextValue>
        <!--Optional:-->
        <erp:UserKeyA>${invoiceNumber}</erp:UserKeyA>
        <!--Optional:-->
        <erp:UserKeyB>#NULL</erp:UserKeyB>
        <!--Optional:-->
        <erp:UserKeyC>#NULL</erp:UserKeyC>
        <!--Optional:-->
        <erp:UserKeyD></erp:UserKeyD>
        <!--Optional:-->
        <erp:UserKeyE>#NULL</erp:UserKeyE>
        <!--Optional:-->
        <erp:UserKeyF>#NULL</erp:UserKeyF>
        <!--Optional:-->
        <erp:UserKeyG>#NULL</erp:UserKeyG>
        <!--Optional:-->
        <erp:UserKeyH>#NULL</erp:UserKeyH>
        <!--Optional:-->
        <erp:DFFAttributes>{"ATTRIBUTE1": ${ATTRIBUTE1},"ATTRIBUTE2":${ATTRIBUTE2},"ATTRIBUTE3":${ATTRIBUTE3},"ATTRIBUTE4": ${ATTRIBUTE4}}</erp:DFFAttributes>
        </typ:object>
        <!--Optional:-->
        <typ:notificationCode>10</typ:notificationCode>
        <!--Optional:-->
        <typ:callbackURL>#NULL</typ:callbackURL>
        </typ:updateDffEntityDetails>
        </soapenv:Body>
        </soapenv:Envelope>`;

        const url = 'https://ehpw-test.fa.ap1.oraclecloud.com:443/fscmService/ErpObjectDFFUpdateService';
        const username = 'Automation_Team';
        const password = 'MIT@1234';

        var config = {
            headers: {
                'Content-Type': 'text/xml',
                'Authorization': `Basic ${Buffer.from(username + ':' + password).toString('base64')}`
            }
        };
        const response = await axios.post(url, soapRequest,config);

        xml2js.parseStringPromise(response.data, { explicitArray: false }).then(parsedResponse => {
            const result = parsedResponse["env:Envelope"]["env:Body"]["ns0:updateDffEntityDetailsResponse"]["result"]["_"];

            if (result === '1') {
                console.log('Successful update');
                res.json({ message: 'Successful update', result });
            } else {
                // console.log('Update failed, will retry in 10 minutes');
                res.json({message: `Attempt ${attempt}: Update failed, will retry in 10 minutes`, result})
                if(attempt < 3) {
                    setTimeout(() => sendSoapRequest(invoiceNumber, ATTRIBUTE1, ATTRIBUTE2, ATTRIBUTE3, ATTRIBUTE4, res), 600000); // 10 minutes    
                }
                else {
                    res.json({ message: 'Failed to update after 3 attempts' });
                }
            }
        }).catch(parseError => {
            res.status(500).send('Error parsing XML response');
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error in processing request');
    }
}



async function callSoapEndpointPO(poNumber) {
    const soapBody = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">
    <soap:Header/>
    <soap:Body>
    <pub:runReport>
    <pub:reportRequest>
    <pub:attributeFormat></pub:attributeFormat>
    <pub:flattenXML></pub:flattenXML>
    <pub:parameterNameValues>
    <pub:item>
    <pub:name>PO_NUMBER</pub:name>
    <pub:values>
    <pub:item>${poNumber}</pub:item>
    </pub:values>
    </pub:item>
    </pub:parameterNameValues>
    <pub:reportAbsolutePath>/Custom/MIT/Common/Webservices/PO.xdo</pub:reportAbsolutePath>
    <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>
    </pub:reportRequest>
    </pub:runReport>
    </soap:Body>
    </soap:Envelope>`;

    const username = 'Automation_Team';
    const password = 'MIT@1234';
    const basicAuth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

    try {
        const response = await axios.post('https://ehpw-test.fa.ap1.oraclecloud.com:443/xmlpserver/services/ExternalReportWSSService', soapBody, {
            headers: {
                'Content-Type': 'application/soap+xml',
                'Authorization': basicAuth
            }
        });
        return response.data;
    } catch (error) {
        console.log(response)
        throw new Error('Error in SOAP request: ' + error.message);
    }

}

async function callSoapEndpointSO(soNumber) {
    const soapBody = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">
    <soap:Header/>
    <soap:Body>
    <pub:runReport>
    <pub:reportRequest>
    <pub:attributeFormat></pub:attributeFormat>
    <pub:flattenXML></pub:flattenXML>
    <pub:parameterNameValues>
    <pub:item>
    <pub:name>SO_NUMBER</pub:name>
    <pub:values>
    <pub:item>${soNumber}</pub:item>
    </pub:values>
    </pub:item>
    </pub:parameterNameValues>
    <pub:reportAbsolutePath>/Custom/MIT/Common/Webservices/Invoices.xdo</pub:reportAbsolutePath>
    <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>
    </pub:reportRequest>
    </pub:runReport>
    </soap:Body>
    </soap:Envelope>`;

    const username = 'Automation_Team';
    const password = 'MIT@1234';
    const basicAuth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

    try {
        const response = await axios.post('https://ehpw-test.fa.ap1.oraclecloud.com:443/xmlpserver/services/ExternalReportWSSService', soapBody, {
            headers: {
                'Content-Type': 'application/soap+xml',
                'Authorization': basicAuth
            }
        });
        // console.log(response.data);
        return response.data;
        
    } catch (error) {
        throw new Error('Error in SOAP request: line 111' + error);
    }

}

async function getSellingRate(toCurrency, fromCurrency, type, conversionDate) {
    const soapBody = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" 
    xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">
    <soap:Header/>
    <soap:Body>
    <pub:runReport>
    <pub:reportRequest> 
    <pub:attributeFormat></pub:attributeFormat>
    <pub:flattenXML></pub:flattenXML>
    <pub:parameterNameValues>
    <pub:item>
    <pub:name>to_currency</pub:name>
    <pub:values>
    <pub:item>${toCurrency}</pub:item>
    </pub:values>
    </pub:item>
    <pub:item>
    <pub:name>from_currency</pub:name>
    <pub:values>
    <pub:item>${fromCurrency}</pub:item>
    </pub:values>
    </pub:item>
    <pub:item>
    <pub:name>type</pub:name>
    <pub:values>
    <pub:item>${type}</pub:item>
    </pub:values>
    </pub:item>
    <pub:item>
    <pub:name>conversion_date</pub:name>
    <pub:values>
    <pub:item>${conversionDate}</pub:item>
    </pub:values>
    </pub:item>
    </pub:parameterNameValues>
    <pub:reportAbsolutePath>/Custom/MIT/Common/Webservices/RATE.xdo</pub:reportAbsolutePath>     
    <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>
    </pub:reportRequest>
    </pub:runReport>
    </soap:Body>
    </soap:Envelope>`

    const username = 'Automation_Team';
    const password = 'MIT@1234';
    const basicAuth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

    try {
        const response = await axios.post('https://ehpw-test.fa.ap1.oraclecloud.com:443/xmlpserver/services/ExternalReportWSSService', soapBody, {
            headers: {
                'Content-Type': 'application/soap+xml',
                'Authorization': basicAuth
            }
        });
//      console.log("respinse - " + response.data);
        return response.data;
        
    } catch (error) {
        throw new Error('Error in SOAP request: ' + error);
    }

}


async function convertToJSONPO(soapResponse) {
    const base64Data = extractBase64Data(soapResponse);

    // Decode the base64 string
    const decodedXml = Buffer.from(base64Data, 'base64').toString('utf-8');


    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });

    // Parse XML to JSON
    try {
        const result = await parser.parseStringPromise(decodedXml);
        const items = result.DATA_DS.G_1;
        return Array.isArray(items) ? items : [items];
    } catch (error) {
        throw new Error('Error parsing XML: line 144 ' + error);
    }
}


async function convertToJSONSO(soapResponse) {
    const base64Data = extractBase64Data(soapResponse);
    //console.log(base64Data);

    // Decode the base64 string
    const decodedXml = Buffer.from(base64Data, 'base64').toString('utf-8');


    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });

    // Parse XML to JSON
    try {
        const result = await parser.parseStringPromise(decodedXml);

         // Extract the G_1 elements and ensure it's an array
         const g1Elements = Array.isArray(result.DATA_DS.G_1) ? result.DATA_DS.G_1 : [result.DATA_DS.G_1];
        console.log(g1Elements);

         // Map each G_1 element to a JSON object
         return g1Elements.map(g1 => {
             
            // Create an object for G_1 element attributes
            const g1Obj = {
                INVOICE_NUMBER: g1.INVOICE_NUMBER,
                CUSTOMER_NAME: g1.CUSTOMER_NAME,
                SO_NUMBER: g1.SO_NUMBER,
                CURRENCY_CODE: g1.CURRENCY_CODE
            };

            // If G_2 elements exist, process and merge them into the main object
            if (g1.G_2) {
                const g2Elements = Array.isArray(g1.G_2) ? g1.G_2 : [g1.G_2];

                g2Elements.forEach(g2 => {
                    g1Obj.TRX_DATE = g2.TRX_DATE;
                    g1Obj.COLLECT_AMOUNT = g2.COLLECT_AMOUNT;
                    g1Obj.STATUS = g2.STATUS;
                    g1Obj.INVOICE_AMOUNT = g2.INVOICE_AMOUNT;
                    g1Obj.ACCOUNT_MANAGER = g2.ACCOUNT_MANAGER;
                    g1Obj.CURRENCY_CODE = g2.CURRENCY_CODE
                });
            }
 
             return g1Obj;
    })
 } catch (error) {
        throw new Error('Error parsing XML: line 176' + error.message);
    }
}

async function convertToJSONRate(response) {

    const base64Data = extractBase64Data(response);
//  console.log(base64Data);

    // Decode the base64 string
    const decodedXml = Buffer.from(base64Data, 'base64').toString('utf-8');


    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });

    // Parse XML to JSON
    try {
        const result = await parser.parseStringPromise(decodedXml);
        if (result && result.DATA_DS && result.DATA_DS.G_1) {
            console.log(result);
            return {
                details: {
                    CONVERSION_RATE: result.DATA_DS.G_1.CONVERSION_RATE,
                    CONVERSION_TYPE: result.DATA_DS.G_1.CONVERSION_TYPE,
                    FROM_CURRENCY: result.DATA_DS.G_1.FROM_CURRENCY,
                    TO_CURRENCY: result.DATA_DS.G_1.TO_CURRENCY,
                    CONVERSION_DATE: result.DATA_DS.G_1.CONVERSION_DATE
                }
            };
        } else {
            throw new Error("Please check code from function convertToJSONRate");
        }
        // const items = result.DATA_DS.G_1;
        // return Array.isArray(items) ? items : [items];
    } catch (error) {
        throw new Error('Error parsing XML: ' + error);
    }
}


function extractBase64Data(soapResponse) {
    const match = soapResponse.match(/<ns2:reportBytes>(.*?)<\/ns2:reportBytes>/);
    if (match && match[1]) {
        return match[1];
    }
    return '';
}

// async function convertToJSON(soapResponse) {
//     const base64Data = extractBase64Data(soapResponse);

//     // Decode the base64 string
//     const decodedXml = Buffer.from(base64Data, 'base64').toString('utf-8');


//     const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });

//     // Parse XML to JSON
//     try {
//         const result = await parser.parseStringPromise(decodedXml);
//         if (result && result.DATA_DS && result.DATA_DS.G_1) {
//             return {
//                 PO_NUMBER: result.DATA_DS.PO_NUMBER,
//                 details: {
//                     PO_NO: result.DATA_DS.G_1.PO_NO,
//                     GRN_NUM: result.DATA_DS.G_1.GRN_NUM,
//                     VENDOR_NAME: result.DATA_DS.G_1.VENDOR_NAME,
//                     VENDOR_ID: result.DATA_DS.G_1.VENDOR_ID,
//                     COUNTRY: result.DATA_DS.G_1.COUNTRY
//                 }
//             };
//         } else {
//             throw new Error('Invalid XML format');
//         }
//     } catch (error) {
//         throw new Error('Error parsing XML: ' + error.message);
//     }
// }


// function extractBase64Data(soapResponse) {
//     const match = soapResponse.match(/<ns2:reportBytes>(.*?)<\/ns2:reportBytes>/);
//     if (match && match[1]) {
//         return match[1];
//     }
//     return '';
// }

module.exports = router;

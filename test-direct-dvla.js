// Direct test of DVLA API
const https = require('https');

const registration = 'AY66MGZ';
const apiKey = '6j9kcIXNug57aSEJsiGUS4jN2mEQqGjW1imYOvoa';

const postData = JSON.stringify({ registrationNumber: registration });

const options = {
  hostname: 'driver-vehicle-licensing.api.gov.uk',
  port: 443,
  path: '/vehicle-enquiry/v1/vehicles',
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 30000
};

console.log('Testing DVLA API connection...');
console.log('Registration:', registration);
console.log('');

const req = https.request(options, (res) => {
  console.log('✅ Response received!');
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  console.log('');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response body:');
    console.log(data);
    try {
      const json = JSON.parse(data);
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('(Could not parse as JSON)');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.error('Error code:', error.code);
});

req.on('timeout', () => {
  console.error('❌ Request timeout');
  req.destroy();
});

req.write(postData);
req.end();
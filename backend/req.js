const axios = require('axios');
axios.post('http://localhost:3002/api/qr/scan', { token: 'LUXURY-b336b457-3db1-4fc7-a3f8-cfad43af5e0e-1774236407606' }, {
  headers: {
    // We need an employee token. But wait! There's no token in my test request.
    // If I don't send auth token, I get a 401. 
  }
}).catch(e => console.log(e.response.data, e.response.status));

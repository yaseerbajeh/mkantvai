// Test PayPal route - Copy this into your browser console

// Single-line version for browser console:
fetch('/api/paypal/create-order', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({productCode: 'TEST', productName: 'Test Product', price: 100})}).then(r => r.json()).then(console.log).catch(console.error);

// Or use this multi-line version (paste all at once):
fetch('/api/paypal/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productCode: 'TEST',
    productName: 'Test Product',
    price: 100,
    currency: 'SAR'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Success:', data);
})
.catch(error => {
  console.error('Error:', error);
});


# المسند لصيانة السيارات - نسخة تجريبية / Al Musnad Car Maintenance - demo

A static demo of the complete garage system (Plan 3). No server, no database, no passwords to set up.
Example data only: every customer, car, plate, price and bill inside is invented. Whatever a visitor does is saved in
his own browser only.

- **Limit:** 5 new bills per browser. The example bills do not count. "Reset demo" brings the example data back
  but does not give the 5 bills back.
- **Sign in:** the sign-in screen lists the demo accounts (owner, front desk, technician); one press signs in.
- **Pages:** `index.html` (opens the system), `login/index.html`, `pos/index.html`.

To publish: upload the contents of this folder to any address you send to Al Musnad Car Maintenance.
Built by `node tools/make-demo.js` in the "garage demo" folder. Do not edit these files by hand: rebuild instead.

const admin = require("firebase-admin");
const serviceAccount = require("./bot-d941d-firebase-adminsdk-fbsvc-25d9e09bb0.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://appchatbot-d941d-default-rtdb.firebaseio.com"
});

const db = admin.database();
const ref = db.ref("/"); // "/" para toda la base de datos

// Escucha cambios en tiempo real
ref.on("value", snapshot => {
  console.clear(); // limpia consola para ver solo el último estado
  console.log("Datos actuales de la base de datos:");
  console.log(JSON.stringify(snapshot.val(), null, 2));
});

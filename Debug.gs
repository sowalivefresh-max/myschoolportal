function checkLoginDebug() {
  try {
    var email = "developer@school.portal";
    var users = firebaseQuery("users", [{ field: "email", op: "EQUAL", value: email }]);
    Logger.log(JSON.stringify(users, null, 2));
  } catch(e) {
    Logger.log("Error: " + e.message);
  }
}

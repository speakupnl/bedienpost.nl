<html>
<body>
<?php
	require_once("../db_auth.php");

	$db = new mysqli("localhost", $SQLUSER, $SQLPASS, "bedien01_main");

	// For now, expect auth as md5 hash of <username>:<server>:<password> string.
	$username = ($_POST['username']) ? $_POST['username'] : "";
	$server = ($_POST['server']) ? $_POST['server'] : "";
	$phoneIp = ($_POST['phoneIp']) ? $_POST['phoneIp'] : "";
	$phoneUser = ($_POST['phoneUser']) ? $_POST['phoneUser'] : "";
	$phonePass = ($_POST['phonePass']) ? $_POST['phonePass'] : "";
	$companyName = ($_POST['companyName']) ? $_POST['companyName'] : "";

	//echo ("Query input: $username, $server, $auth");

	$statement = $db->prepare("REPLACE INTO users VALUES (?, ?, ?, ?, ?, ?)");

	$statement->bind_param("ssssss", $username, $server, $phoneIp, $phoneUser, $phonePass, $companyName);
	$result = $statement->execute();
	if ($result) {
	    echo "Phone-authorisation stored.";
	} else {
	    echo "Phone-authorisation NOT stored.";
	}

	$statement->close();

?>
</body>
</html>
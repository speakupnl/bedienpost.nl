<?php

    require_once("generic.php");

	// For now, expect auth as md5 hash of <username>:<server>:<password> string.
	$username = ($_POST['username']) ? $_POST['username'] : "";
	$server = ($_POST['server']) ? $_POST['server'] : "";
	$auth = ($_POST['auth']) ? $_POST['auth'] : "";

	//echo ("Query input: $username, $server, $auth");

	$statement = $db->prepare("SELECT phoneIp, phoneUser, phonePass, username, server FROM users WHERE username = ? AND server = ?");
	$statement->bind_param("ss", $username, $server);
	$statement->execute();
	$statement->bind_result($phoneIp, $phoneUser, $phonePass, $username, $server);
	$statement->fetch();

    $authRes = false;
    if ($phoneIp) {
        $authRes = checkRestAuth($username, $server, $auth);
    }

	if ($phoneIp && ($authRes != false)) {
		$clientData = array('phoneIp' => $phoneIp, 'phoneUser' => $phoneUser, 'phonePass' => $phonePass);
		header('Content-type: application/json');
		echo json_encode($clientData);
	} else {
	    header('HTTP/1.0 403 Forbidden');
	}

	$statement->close();

?>
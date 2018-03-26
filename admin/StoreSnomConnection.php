<html>
<body>
<?php
	require_once("../generic.php");

    // Support OPTIONS request without authentication
    if ($_SERVER['REQUEST_METHOD'] == "OPTIONS") {
        header("Access-Control-Allow-Headers: Authorization");
        exit;
    }

    // split the user/pass parts
    list($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) = explode(':', base64_decode(substr($_SERVER['HTTP_AUTHORIZATION'], 6)));
    if (!isset($_SERVER['PHP_AUTH_USER'])) {
        header('WWW-Authenticate: Basic realm="Verbinding met VoIP telefoon."');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Please authenticate';
        exit;
    }
    if (checkUser($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) == false) {
        header('WWW-Authenticate: Basic realm="Verbinding met VoIP telefoon."');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Please authenticate';
        exit;
    }

    $enable = ($_POST['ingeschakeld']) ? $_POST['ingeschakeld'] : false;

    $login = $_SERVER['PHP_AUTH_USER'];
    $loginsplit = explode("@", $login);
    $username = $loginsplit[0];
    $server = null;
    if ($loginsplit[1] == null) {
        $server = "uc.pbx.speakup-telecom.com";
    } else {
        $server = $loginsplit[1];
    }

    //echo ("Query input: $username, $server, $auth");
    $phoneIp = "auto";
    $phoneUser = "auto";
    $phonePass = "auto";
    $companyName = null;

    if ($enable) {
        $statement = $db->prepare("REPLACE INTO users VALUES (?, ?, ?, ?, ?, ?)");

        $statement->bind_param("ssssss", $username, $server, $phoneIp, $phoneUser, $phonePass, $companyName);
        $result = $statement->execute();
        if ($result) {
            echo "Phone-authorisation stored.";
        } else {
            echo "WARNING: Phone-authorisation NOT stored.";
        }

	    $statement->close();

	} else {
	    $statement = $db->prepare("DELETE FROM users WHERE username = ? AND server = ?");
        $statement->bind_param("ss", $username, $server);
        $result = $statement->execute();
        if ($result) {
            echo "Phone-authorisation removed.";
        } else {
            echo "WARNING Phone-authorisation NOT removed.";
        }

        $statement->close();
	}

?>
</body>
</html>
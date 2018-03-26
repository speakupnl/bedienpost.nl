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
        header('WWW-Authenticate: Basic realm="Admin"');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Please authenticate';
        exit;
    }
    $authRes = checkUser($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']);
    if ($authRes == false) {
        header('WWW-Authenticate: Basic realm="Admin"');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Please authenticate';
        exit;
    }

    $obfuscateNumber = ($_POST['obfuscateNumber']) ? $_POST['obfuscateNumber'] : false;

    $companyObj = json_decode($authRes);
    $company = $companyObj->name;

    $login = $_SERVER['PHP_AUTH_USER'];
    $loginsplit = explode("@", $login);
    $username = $loginsplit[0];
    $server = null;
    if ($loginsplit[1] == null) {
        $server = "uc.pbx.speakup-telecom.com";
    } else {
        $server = $loginsplit[1];
    }

    $key = "company_hideLastPartPhoneNumber";
    $data = "false";
    $username = ""; // For company-wide settings, the username becomes empty.

    if ($obfuscateNumber) {

        $statement = $db->prepare("DELETE FROM remotestorage WHERE `username` = ? AND `company` = ? AND `server` = ? AND `key` = ?");
        $statement->bind_param("ssss", $username, $company, $server, $key);
        $result = $statement->execute();
        if ($result) {
            echo 'resultaat opgeslagen - nummer wordt verborgen';
        } else {
            echo 'resultaat NIET opgeslagen';
        }

        $statement->close();

	} else {

        $statement = $db->prepare("REPLACE INTO remotestorage (`username`, `company`, `server`, `key`, `data`) VALUES (?, ?, ?, ?, ?)");

        $statement->bind_param("sssss", $username, $company, $server, $key, $data);
        //echo "$username, $company, $server, $key, $data";
        $result = $statement->execute();
        if (!$result) {
            header('HTTP/1.0 500 Internal Server Error - Data not saved.');
            echo "{}";
            exit;
        }

        echo 'resultaat opgeslagen - nummer wordt niet verborgen';

        $statement->close();
	}

?>
</body>
</html>
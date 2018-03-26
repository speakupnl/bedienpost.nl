    <?php

    require_once("generic.php");

	// For now, expect auth as md5 hash of <username>:<server>:<password> string.
	$username = ($_POST['username']) ? $_POST['username'] : "";
	$server = ($_POST['server']) ? $_POST['server'] : "";
	$auth = ($_POST['auth']) ? $_POST['auth'] : "";
	$method = ($_POST['method']) ? $_POST['method'] : "getItem";
	$key = ($_POST['key']);
	$data = ($_POST['data']);

	//echo ("Query input: $username, $server, $auth");

    $authRes = checkRestAuth($username, $server, $auth);
    if (!$authRes) {
        header('HTTP/1.0 403 Forbidden');
        exit;
    }

    if ($method == "getItem") {
        $statement = $db->prepare("SELECT username, `server`, `key`, `data` FROM `remotestorage` WHERE `username` = ? AND `server` = ? AND `key` = ?");
        $statement->bind_param("sss", $username, $server, $key);
        $statement->execute();
        $statement->bind_result($username, $server, $key, $data);
        $statement->fetch();

        header('Content-type: application/json');
        echo json_encode($data);

        $statement->close();
        exit;

    } else if ($method = "setItem") {
        $statement = $db->prepare("REPLACE INTO remotestorage (`username`, `server`, `key`, `data`) VALUES (?, ?, ?, ?)");

        $statement->bind_param("ssss", $username, $server, $key, $data);
        $result = $statement->execute();
        if (!$result) {
            header('HTTP/1.0 500 Internal Server Error - Data not saved.');
            header('Content-type: application/json');
            echo "{}";
        }

        header('Content-type: application/json');
        echo '{"result": true}';
        $statement->close();
        exit;

    } else {
        header('HTTP/1.0 400 Bad Request - Unknown method parameter, use getItem or setItem.');
        exit;
    }

?>
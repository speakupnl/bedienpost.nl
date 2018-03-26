    <?php

    require_once("generic.php");

	// For now, expect auth as md5 hash of <username>:<server>:<password> string.
	$username = ($_POST['username']) ? $_POST['username'] : "";
	$server = ($_POST['server']) ? $_POST['server'] : "";
	$auth = ($_POST['auth']) ? $_POST['auth'] : "";

	$iperity_company_id = ($_POST['company_id']);

    $authRes = checkRestAuth($username, $server, $auth);
    if (!$authRes) {
        header('HTTP/1.0 403 Forbidden');
        exit;
    }


    // Prepared statements.
    $statement = $db->prepare("SELECT `id`, `firstname`, `lastname`, `company`, `iperity_company_id` FROM `contacts` WHERE `iperity_company_id` = ?");
    $numstatement = $db->prepare("SELECT `contact_id`, `numberType`, `number` FROM `contact_numbers` WHERE `contact_id` = ?");


    // To Store what we want to return
    $data = array();

    // Execute outer query.
    $statement->bind_param("s", $iperity_company_id);
    $statement->execute();
    $statement->store_result();
    $statement->bind_result($id, $firstname, $lastname, $company, $iperity_company_id);

    // Retrieve results.
    while ($statement->fetch()) {

        $fullname = trim($firstname . " " . $lastname);
        //echo "Got: " . $id . " " . $fullname . "\n";
        $numbers = array();

        // Execute inner query.
        $numstatement->bind_param("i", $id);
        $numstatement->execute();
        $numstatement->store_result();
        $numstatement->bind_result($id, $numberType, $number);

        while ($numstatement->fetch()) {
            //echo  $numberType . ": " . $number . "\n";
            $number = preg_replace('/[^0-9.]+/', '', $number);
            $numbers[] = array('name' => $numberType, 'number' => $number);
        }

        $data[] = array('id' => $id, 'name' => $fullname, 'company' => $company, 'numbers' => $numbers);
    }


    header('Content-type: application/json');
    if (version_compare(phpversion(), '5.5', '<')) {
        echo json_encode($data);
    } else {
        echo json_encode($data, JSON_PARTIAL_OUTPUT_ON_ERROR);
    }


    $statement->close();
    $numstatement->close();
    exit;



?>
<?php
    require_once("../generic.php");
    require_once("lib/vCard.php");

    // split the user/pass parts
    list($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) = explode(':', base64_decode(substr($_SERVER['HTTP_AUTHORIZATION'], 6)));
    if (!isset($_SERVER['PHP_AUTH_USER'])) {
        header('WWW-Authenticate: Basic realm="My Realm"');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Please authenticate';
        exit;
    }

    $companyFromRest = checkUser($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']);
    if ($companyFromRest != false) {

        // Extract the company-id.
        $iperity_company_id = null;
        $companyFromRestDecoded = json_decode($companyFromRest);
        $iperity_company_id = $companyFromRestDecoded -> entityId;
        $iperity_company_name = $companyFromRestDecoded -> name;

        $contents = null;
        if ($_FILES['uploadedfile']['error'] == UPLOAD_ERR_OK               //checks for errors
              && is_uploaded_file($_FILES['uploadedfile']['tmp_name'])) { //checks that file is uploaded
          $uploadedFileContents = file_get_contents($_FILES['uploadedfile']['tmp_name']);
        }

        if ($uploadedFileContents == null) {
            header('HTTP/1.0 400 Bad Request - File upload failed.');
            exit;
        }

        // Preferably perform the entire import in a single transaction.
        $db->autocommit(false);

        // MySQL prepared statements
        $delStatement = $db->prepare("DELETE FROM contacts WHERE iperity_company_id=?");
        $contactstatement = $db->prepare("INSERT INTO contacts VALUES (NULL, ?, ?, ?, ?)");
        $numberstatement = $db->prepare("INSERT INTO contact_numbers VALUES (?, ?, ?)");


         // Delete all previous contacts

         $delStatement->bind_param("s", $iperity_company_id);
         $result = $delStatement->execute();

        $vCard = new vCard(false, $uploadedFileContents);

        $contactCount = 0;
        $numberCount = 0;

        foreach ($vCard as $vCardPart)
        {
            if (count($vCard) == 1) {
                $vCardPart = $vCard;
            }


            //print_r($vCardPart);
            //print_r($vCardPart -> fn);
            //print_r($vCardPart -> tel);

            $names = $vCardPart -> n [0];
            $firstName = $names[FirstName];
            $lastName = $names[LastName];

            if (($firstName.$lastName) === '') {
                $lastName = $vCardPart -> fn [0];
            }

            $organisation = $vCardPart -> org[0][Name];
            //echo "For " . $firstName . " " . $lastName . " - " . $organisation . "\n";

            // Insert contacts

            $contactstatement->bind_param("ssss", $firstName, $lastName, $organisation, $iperity_company_id);
            $result = $contactstatement->execute();
            $contactCount++;

            $contactId = $db->insert_id;
            //echo "Contact ID: " . $contactId;

            foreach ($vCardPart -> tel as $number) {

                if (is_array($number)) {
                    $num = $number[Value];
                    $type = $number[Type][0];
                } else {
                    $num = $number;
                    $type = "other";
                }

                // Insert numbers
                $numberstatement->bind_param("sss", $contactId, $type, $num);
                $result = $numberstatement->execute();
                $numberCount++;

                /*
                print_r($type);
                echo ":";
                print_r($num);
                echo "\n";
                */
            }
            //echo "\n";

            if (count($vCard) == 1) {
                break;
            }
        }

        // Commit
        $db->commit();
        echo "VCard import for $iperity_company_name completed successfully. Imported $contactCount contacts, with $numberCount numbers in total.";
    }
?>
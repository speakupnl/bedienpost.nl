<?php
    require_once("../generic.php");
    require_once("lib/vCard.php");

    $iperity_company_id = 8323266; // Tinkertank company.

    $delStatement = $db->prepare("DELETE FROM contacts WHERE iperity_company_id=?");
    $contactstatement = $db->prepare("INSERT INTO contacts VALUES (NULL, ?, ?, ?, ?)");
    $numberstatement = $db->prepare("INSERT INTO contact_numbers VALUES (?, ?, ?)");


     // Delete all previous contacts

     $delStatement->bind_param("s", $iperity_company_id);
     $result = $delStatement->execute();

    for ($i = 1; $i <= 1500; $i++) {
        $firstName = "first".$i;
        $lastName = "last".$i;
        $organisation = "organisation".$i;
        echo "For " . $firstName . " " . $lastName . " - " . $organisation . "\n";

        // Insert contacts

        $contactstatement->bind_param("ssss", $firstName, $lastName, $organisation, $iperity_company_id);
        $result = $contactstatement->execute();
        $contactCount++;

        $contactId = $db->insert_id;

        $type = "work";
        $num = "000" . $i;
        $numberstatement->bind_param("sss", $contactId, $type, $num);
        $result = $numberstatement->execute();
        $numberCount++;
    }

    echo "VCard import for $iperity_company_name completed successfully. Imported $contactCount contacts, with $numberCount numbers in total.";
?>
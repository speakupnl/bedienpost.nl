<?php

    require_once("db_auth.php");

    function checkRestAuth($username, $server, $auth) {
            $restServer = str_replace("uc.", "rest.", $server);
            $url = "https://".$restServer."/company";
            $authHeader = "Authorization: Basic " . $auth;

            $ch = curl_init();
            $timeout = 5; // set to zero for no timeout

            curl_setopt ($ch, CURLOPT_URL, $url);
            curl_setopt ($ch, CURLOPT_HTTPHEADER, array($authHeader,  "X-No-Redirect: true"));
            curl_setopt ($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt ($ch, CURLOPT_CONNECTTIMEOUT, $timeout);

            $result = curl_exec($ch);

            return $result;
    }

    function checkUser($login, $pass) {
        $loginsplit = explode("@", $login);
        $username = $loginsplit[0];
        $server = null;

        if ($loginsplit[1] == null) {
            $server = "uc.pbx.speakup-telecom.com";
        } else {
            $server = $loginsplit[1];
        }

        $auth = base64_encode($username.":".$pass);
        return checkRestAuth($username, $server, $auth);
    }

    $db = new mysqli("localhost", $SQLUSER, $SQLPASS, "bedien01_main");

    header('Access-Control-Allow-Origin: *');
?>
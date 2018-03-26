-- phpMyAdmin SQL Dump
-- version 3.5.8.2
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Feb 13, 2015 at 02:48 PM
-- Server version: 5.5.41-cll-lve
-- PHP Version: 5.3.29

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Database: `bedien01_main`
--

-- --------------------------------------------------------

--
-- Table structure for table `remotestorage`
--

CREATE TABLE IF NOT EXISTS `remotestorage` (
  `username` varchar(160) NOT NULL,
  `company` varchar(160) NOT NULL DEFAULT '',
  `server` varchar(128) NOT NULL,
  `key` varchar(255) NOT NULL,
  `data` blob,
  PRIMARY KEY (`username`,`company`,`server`,`key`),
  KEY `company` (`company`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

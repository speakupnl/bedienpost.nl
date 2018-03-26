--
-- Table structure for table `contacts`
--

CREATE TABLE IF NOT EXISTS `contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firstname` varchar(64) DEFAULT NULL,
  `lastname` varchar(64) DEFAULT NULL,
  `company` varchar(256) DEFAULT NULL,
  `iperity_company_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `iperity_company_id` (`iperity_company_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=29 ;
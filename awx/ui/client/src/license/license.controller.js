/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

import {N_} from "../i18n";

export default
    ['Wait', '$state', '$scope', '$rootScope',
    'ProcessErrors', 'CheckLicense', 'moment','$window',
    'ConfigService', 'FeaturesService', 'pendoService', 'i18n', 'config', 'Rest', 'GetBasePath',
    function(Wait, $state, $scope, $rootScope, ProcessErrors, CheckLicense, moment,
    $window, ConfigService, FeaturesService, pendoService, i18n, config, Rest, GetBasePath) {

        const calcDaysRemaining = function(seconds) {
      	 		// calculate the number of days remaining on the license
      			let duration = moment.duration(seconds, 'seconds').asDays();

      			duration = Math.floor(duration);
                if(duration < 0){
                    duration = 0;
                }

                duration = (duration!==1) ? `${duration} Days` : `${duration} Day`;

    			      return duration;
    	 	};

        const calcExpiresOn = function(seconds) {
            // calculate the expiration date of the license
            return moment.unix(seconds).calendar();
        };

        const reset = function() {
            document.getElementById('License-form').reset();
        };

        const init = function(config) {
            // license/license.partial.html compares fileName
            $scope.fileName = N_("No file selected.");

            if ($rootScope.licenseMissing) {
                $scope.title = $rootScope.BRAND_NAME + i18n._(" License");
            } else {
                $scope.title = i18n._("License Management");
            }

            $scope.license = config;
            $scope.license.version = config.version.split('-')[0];
            $scope.time = {};
            $scope.time.remaining = calcDaysRemaining($scope.license.license_info.time_remaining);
            $scope.time.expiresOn = calcExpiresOn($scope.license.license_info.license_date);
            $scope.valid = CheckLicense.valid($scope.license.license_info);
            $scope.compliant = $scope.license.license_info.compliant;
            $scope.newLicense = {};

            Rest.setUrl(`${GetBasePath('settings')}ui`);
            Rest.get()
                .then(({data}) => {
                    if (data.PENDO_TRACKING_STATE === 'off' && !$rootScope.licenseMissing) {
                        $scope.newLicense.pendo = false;
                    } else {
                        $scope.newLicense.pendo = true;
                    }
                })
                .catch(() => {
                    // default pendo tracking to true when settings is not accessible
                    $scope.newLicense.pendo = true;
                });
        };

        init(config);

        $scope.getKey = function(event) {
            // Mimic HTML5 spec, show filename
            $scope.fileName = event.target.files[0].name;
            // Grab the key from the raw license file
            const raw = new FileReader();
            // readAsFoo runs async
            raw.onload = function() {
                try {
                    $scope.newLicense.file = JSON.parse(raw.result);
                } catch(err) {
                    ProcessErrors($rootScope, null, null, null,
                        {msg: i18n._('Invalid file format. Please upload valid JSON.')});
                }
            };

            try {
                raw.readAsText(event.target.files[0]);
            } catch(err) {
                ProcessErrors($rootScope, null, null, null,
                    {msg: i18n._('Invalid file format. Please upload valid JSON.')});
            }
        };

        // HTML5 spec doesn't provide a way to customize file input css
        // So we hide the default input, show our own, and simulate clicks to the hidden input
        $scope.fakeClick = function() {
            if($scope.user_is_superuser) {
                $('#License-file').click();
            }
        };

        $scope.downloadLicense = function() {
            $window.open('https://www.ansible.com/license', '_blank');
        };

    		$scope.submit = function() {
      			Wait('start');
      			CheckLicense.post($scope.newLicense.file, $scope.newLicense.eula)
      				  .then(() => {
        				    reset();

                    ConfigService.delete();
                    ConfigService.getConfig()
                        .then(function(config) {
                            delete($rootScope.features);
                            FeaturesService.get();

                            if ($scope.newLicense.pendo) {
                                pendoService.updatePendoTrackingState('detailed');
                                pendoService.issuePendoIdentity();
                            } else {
                                pendoService.updatePendoTrackingState('off');
                            }

                            if ($rootScope.licenseMissing === true) {
                                $state.go('dashboard', {
                        	          licenseMissing: false
                                });
                            } else {
                                init(config);
                                $scope.success = true;
                                $rootScope.licenseMissing = false;
                                // for animation purposes
                                const successTimeout = setTimeout(function() {
                        	          $scope.success = false;
                        	          clearTimeout(successTimeout);
                                }, 4000);
                            }
                        });
      			    });
    		};
}];

/**
 * Created by Volker on 12.05.2015.
 */
'use strict';

angular.module('pictures').controller('PictureImgUploadController', ['$scope', '$timeout', '$location', '$window', 'Pictures', 'Authentication', 'FileUploader',
    function ($scope, $timeout, $location, $window, Pictures, Authentication, FileUploader) {
        $scope.authentication = Authentication;
        $scope.loading = false;
        $scope.uploaderUrl = 'api/pictures';


        // Create file uploader instance
        $scope.uploader = new FileUploader({
            url: $scope.uploaderUrl
        });

        // Set the limit to one file
        $scope.uploader.queueLimit = 1;

        // Set file uploader image filter
        $scope.uploader.filters.push({
            name: 'imageFilter',
            fn: function (item, options) {
                var type = '|' + item.type.slice(item.type.lastIndexOf('/') + 1) + '|';
                return '|jpg|png|jpeg|'.indexOf(type) !== -1;
            }
        });

        // Set file uploader image filter
        $scope.uploader.filters.push({
            name: 'sizeFilter',
            fn: function (item, options) {
                return item.size <= 7048000;
            }
        });

        // Called after the user selected a new picture file
        $scope.uploader.onAfterAddingFile = function (fileItem) {
            $scope.addingFileError = null;

        };

        $scope.uploader.onWhenAddingFileFailed = function(item, filter, options) {
            $scope.addingFileError = 'Das Bild muss jpg oder png sein und darf maximal 2 MB gross sein';
        };


        // Called after the user has successfully uploaded a new picture
        $scope.uploader.onSuccessItem = function (fileItem, response, status, headers) {
            // Set Loading to false again
            $scope.loading = false;
            // Set the picture:
            $scope.picture = response;
            // Redirect to picture view
            $scope.uploader.clearQueue();
            $location.path('pictures/' + response._id);
        };

        // Called after the user has failed to uploaded a new picture
        $scope.uploader.onErrorItem = function (fileItem, response, status, headers) {
            // Set Loading to false again
            $scope.loading = false;
            $scope.uploader.clearQueue();
            // Show error message
            $scope.error = response.message;
        };

        $scope.startUpload = function(){
            // Clear messages
            $scope.error = null;

            if($scope.uploader.queue.length < 1){
                $scope.error = 'Bitte ein Bild ' + decodeURI('ausw%C3%A4hlen');
            }
            else{
                // Add the picture data to the http POST body:
                $scope.uploader.queue[0].formData.push({
                    name: $scope.name
                });
                // set loadin and start upload
                $scope.loading = true;
                $scope.uploader.uploadAll();
            }
        };
    }
]);

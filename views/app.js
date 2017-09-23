angular.module('yellowPagesApp', [])
    .controller('searchController', searchController);

const NO_RESULT = "No results, please review your search or try a different one";
const FETCHING_RESULTS = "Fetching results...";

function searchController($scope, $http) {
    $scope.searchLabel = "type your search query";
    $scope.page = 0;
    /**
     * Call to yellow pages api
     */
    $scope.searchYP = function (page) {
        //Check if not empty
        if ($scope.searchQuery.trim().length == 0) {
            return
        }

        $scope.fetchingResults = true;
        //Delete the results when start new search
        $scope.results = [];
        $scope.statusText = FETCHING_RESULTS;
        $scope.page = page;

        if ($scope.searchQuery.length == 0) {
            return;
        }
        
        $http({
            method: 'GET',
            url: '/api/v1/search',
            params: { "q": $scope.searchQuery, "page" : $scope.page }
        }).then(function (response) {
            if (response.data.length > 0) {
                $scope.results = response.data;
                $scope.statusText = "";
            } else {
                $scope.statusText = NO_RESULT;
            }
        }).catch(function (error) {
            $scope.statusText = NO_RESULT;
            console.log(JSON.stringify(error));
        }).finally(function(){
            $scope.fetchingResults = false;
        });
    }

    /**
     * Calculate the age from the epoch time
     */
    $scope.calcAge = function (birthday) {
        var ageDifMs = Date.now() - birthday * 1000;
        var ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
}


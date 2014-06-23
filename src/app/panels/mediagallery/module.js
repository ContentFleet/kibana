/** @scratch /panels/5
 *
 * include::panels/mediagallery.asciidoc[]
 */

/** @scratch /panels/mediagallery/0
 *
 * == mediagallery
 * Status: *Experimental*
 *
 * A media gallery based on the results of an Elasticsearch terms facet.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'kbn'
],
function (angular, app, _, $, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.mediagallery', []);
  app.useModule(module);

  module.controller('mediagallery', function($scope, querySrv, dashboard, filterSrv, fields) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      status  : "Experimental",
      description : "Displays the results of an elasticsearch facet as a media gallery"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/mediagallery/5
       * === Parameters
       *
       * field:: The field on which to computer the facet
       */
      field   : '_type',
      /** @scratch /panels/mediagallery/5
       * exclude:: terms to exclude from the results
       */
      exclude : [],
      /** @scratch /panels/mediagallery/5
       * missing:: Set to false to disable the display of a counter showing how much results are
       * missing the field
       */
      missing : false,
      /** @scratch /panels/mediagallery/5
       * other:: Set to false to disable the display of a counter representing the aggregate of all
       * values outside of the scope of your +size+ property
       */
      other   : false,
      /** @scratch /panels/mediagallery/5
       * size:: Show this many items
       */
      size    : 10,
      /** @scratch /panels/mediagallery/5
       * order:: In terms mode: count, term, reverse_count or reverse_term,
       * in terms_stats mode: term, reverse_term, count, reverse_count,
       * total, reverse_total, min, reverse_min, max, reverse_max, mean or reverse_mean
       */
      order   : 'count',
      style   : { "font-size": '10pt'},
      /** @scratch /panels/mediagallery/5
       * spyable:: Set spyable to false to disable the inspect button
       */
      spyable     : true,
      /** @scratch /panels/mediagallery/5
       *
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
      /** @scratch /panels/mediagallery/5
       * tmode:: Facet mode: terms or terms_stats
       */
      tmode       : 'terms',
      /** @scratch /panels/mediagallery/5
       * tstat:: Terms_stats facet stats field
       */
      tstat       : 'total',
      /** @scratch /panels/mediagallery/5
       * valuefield:: Terms_stats facet value field
       */
      valuefield  : ''
    };

    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.get_data = function() {
      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      $scope.panelMeta.loading = true;
      var request,
        results,
        boolQuery,
        queries;

      $scope.field = _.contains(fields.list,$scope.panel.field+'.raw') ?
        $scope.panel.field+'.raw' : $scope.panel.field;

      request = $scope.ejs.Request().indices(dashboard.indices);

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      // Terms mode
      if($scope.panel.tmode === 'terms') {
        request = request
          .facet($scope.ejs.TermsFacet('terms')
          .field($scope.field)
          .size($scope.panel.size)
          .order($scope.panel.order)
          .exclude($scope.panel.exclude)
          .facetFilter($scope.ejs.QueryFilter(
            $scope.ejs.FilteredQuery(
              boolQuery,
              filterSrv.getBoolFilter(filterSrv.ids())
            )))).size(0);
      }
      if($scope.panel.tmode === 'terms_stats') {
        request = request
          .facet($scope.ejs.TermStatsFacet('terms')
          .valueField($scope.panel.valuefield)
          .keyField($scope.field)
          .size($scope.panel.size)
          .order($scope.panel.order)
          .facetFilter($scope.ejs.QueryFilter(
            $scope.ejs.FilteredQuery(
              boolQuery,
              filterSrv.getBoolFilter(filterSrv.ids())
            )))).size(0);
      }

      // Populate the inspector panel
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);

      results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        if($scope.panel.tmode === 'terms') {
          $scope.hits = results.hits.total;
        }

        $scope.results = results;

        $scope.$emit('render');
      });
    };

    $scope.build_search = function(term,negate) {
      if(_.isUndefined(term.meta)) {
        filterSrv.set({type:'terms',field:$scope.field,value:term.label,
          mandate:(negate ? 'mustNot':'must')});
      } else if(term.meta === 'missing') {
        filterSrv.set({type:'exists',field:$scope.field,
          mandate:(negate ? 'must':'mustNot')});
      } else {
        return;
      }
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
      $scope.$emit('render');
    };

    $scope.showMeta = function(term) {
      if(_.isUndefined(term.meta)) {
        return true;
      }
      if(term.meta === 'other' && !$scope.panel.other) {
        return false;
      }
      if(term.meta === 'missing' && !$scope.panel.missing) {
        return false;
      }
      return true;
    };

  });

  module.directive('termsChart', function(querySrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {
        var plot;

        // Receive render events
        scope.$on('render',function(){
          render_panel();
        });

        function build_results() {
          var k = 0;
          scope.data = [];
          _.each(scope.results.facets.terms.terms, function(v) {
            var slice;
            if(scope.panel.tmode === 'terms') {
              slice = { label : v.term, data : [[k,v.count]], actions: true};
            }
            if(scope.panel.tmode === 'terms_stats') {
              slice = { label : v.term, data : [[k,v[scope.panel.tstat]]], actions: true};
            }
            scope.data.push(slice);
            k = k + 1;
          });
        }

        // Function for rendering panel
        function render_panel() {
          build_results();
        }

      }
    };
  });

});

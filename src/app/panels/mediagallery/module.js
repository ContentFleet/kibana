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
          var chartData;

          build_results();

          // IE doesn't work without this
          elem.css({height:scope.panel.height||scope.row.height});

          // Make a clone we can operate on.
          chartData = _.clone(scope.data);
          chartData = scope.panel.missing ? chartData :
            _.without(chartData,_.findWhere(chartData,{meta:'missing'}));
          chartData = scope.panel.other ? chartData :
          _.without(chartData,_.findWhere(chartData,{meta:'other'}));

          // Populate element.
          require(['jquery.flot.pie'], function(){
            // Populate element
            try {
              // Add plot to scope so we can build out own legend
              if(scope.panel.chart === 'bar') {
                plot = $.plot(elem, chartData, {
                  legend: { show: false },
                  series: {
                    lines:  { show: false, },
                    bars:   { show: true,  fill: 1, barWidth: 0.8, horizontal: false },
                    shadowSize: 1
                  },
                  yaxis: { show: true, min: 0, color: "#c8c8c8" },
                  xaxis: { show: false },
                  grid: {
                    borderWidth: 0,
                    borderColor: '#c8c8c8',
                    color: "#c8c8c8",
                    hoverable: true,
                    clickable: true
                  },
                  colors: querySrv.colors
                });
              }
              if(scope.panel.chart === 'pie') {
                var labelFormat = function(label, series){
                  return '<div ng-click="build_search(panel.field,\''+label+'\')'+
                    ' "style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                    label+'<br/>'+Math.round(series.percent)+'%</div>';
                };

                plot = $.plot(elem, chartData, {
                  legend: { show: false },
                  series: {
                    pie: {
                      innerRadius: scope.panel.donut ? 0.4 : 0,
                      tilt: scope.panel.tilt ? 0.45 : 1,
                      radius: 1,
                      show: true,
                      combine: {
                        color: '#999',
                        label: 'The Rest'
                      },
                      stroke: {
                        width: 0
                      },
                      label: {
                        show: scope.panel.labels,
                        radius: 2/3,
                        formatter: labelFormat,
                        threshold: 0.1
                      }
                    }
                  },
                  //grid: { hoverable: true, clickable: true },
                  grid:   { hoverable: true, clickable: true, color: '#c8c8c8' },
                  colors: querySrv.colors
                });
              }

              // Populate legend
              if(elem.is(":visible")){
                setTimeout(function(){
                  scope.legend = plot.getData();
                  if(!scope.$$phase) {
                    scope.$apply();
                  }
                });
              }

            } catch(e) {
              elem.text(e);
            }
          });
        }

        elem.bind("plotclick", function (event, pos, object) {
          if(object) {
            scope.build_search(scope.data[object.seriesIndex]);
          }
        });

        var $tooltip = $('<div>');
        elem.bind("plothover", function (event, pos, item) {
          if (item) {
            var value = scope.panel.chart === 'bar' ? item.datapoint[1] : item.datapoint[1][0][1];
            $tooltip
              .html(
                kbn.query_color_dot(item.series.color, 20) + ' ' +
                item.series.label + " (" + value.toFixed(0)+")"
              )
              .place_tt(pos.pageX, pos.pageY);
          } else {
            $tooltip.remove();
          }
        });

      }
    };
  });

});

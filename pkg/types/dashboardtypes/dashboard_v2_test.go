package dashboardtypes

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestValidateBigExample(t *testing.T) {
	data, err := os.ReadFile("testdata/perses.json")
	if err != nil {
		t.Fatalf("reading example file: %v", err)
	}
	if _, err := UnmarshalAndValidateDashboardV2JSON(data); err != nil {
		t.Fatalf("expected valid dashboard, got error: %v", err)
	}
}

func TestValidateDashboardWithSections(t *testing.T) {
	data, err := os.ReadFile("testdata/perses_with_sections.json")
	if err != nil {
		t.Fatalf("reading example file: %v", err)
	}
	if _, err := UnmarshalAndValidateDashboardV2JSON(data); err != nil {
		t.Fatalf("expected valid dashboard, got error: %v", err)
	}
}

func TestInvalidateNotAJSON(t *testing.T) {
	if _, err := UnmarshalAndValidateDashboardV2JSON([]byte("not json")); err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestInvalidateEmptyObject(t *testing.T) {
	if _, err := UnmarshalAndValidateDashboardV2JSON([]byte("{}")); err == nil {
		t.Fatal("expected error for empty object missing kind")
	}
}

func TestValidateEmptySpec(t *testing.T) {
	// no variables no panels
	data := []byte(`{
		"kind": "Dashboard",
		"metadata": {"name": "test"},
		"spec": {}
	}`)
	if _, err := UnmarshalAndValidateDashboardV2JSON(data); err != nil {
		t.Fatalf("expected valid, got: %v", err)
	}
}

func TestValidateOnlyVariables(t *testing.T) {
	data := []byte(`{
		"kind": "Dashboard",
		"metadata": {"name": "test", "project": "signoz"},
		"spec": {
			"variables": [
				{
					"kind": "ListVariable",
					"spec": {
						"name": "service",
						"allowAllValue": true,
						"allowMultiple": false,
						"plugin": {
							"kind": "SigNozDynamicVariable",
							"spec": {"name": "service.name", "source": "Metrics"}
						}
					}
				},
				{
					"kind": "TextVariable",
					"spec": {
						"name": "mytext",
						"value": "default",
						"plugin": {
							"kind": "SigNozTextboxVariable",
							"spec": {}
						}
					}
				}
			],
			"layouts": []
		}
	}`)
	if _, err := UnmarshalAndValidateDashboardV2JSON(data); err != nil {
		t.Fatalf("expected valid, got: %v", err)
	}
}

func TestInvalidateWrongKindAtTop(t *testing.T) {
	data := []byte(`{"kind": 123}`)
	if _, err := UnmarshalAndValidateDashboardV2JSON(data); err == nil {
		t.Fatal("expected error for wrong type on kind field")
	}
}

func TestInvalidateUnknownPluginKind(t *testing.T) {
	tests := []struct {
		name        string
		data        string
		wantContain string
	}{
		{
			name: "unknown panel plugin",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {"kind": "NonExistentPanel", "spec": {}}
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "NonExistentPanel",
		},
		{
			name: "unknown query plugin",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {"kind": "SigNozTimeSeriesPanel", "spec": {}},
								"queries": [{
									"kind": "TimeSeriesQuery",
									"spec": {
										"plugin": {"kind": "FakeQueryPlugin", "spec": {}}
									}
								}]
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "FakeQueryPlugin",
		},
		{
			name: "unknown variable plugin",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"variables": [{
						"kind": "ListVariable",
						"spec": {
							"name": "v1",
							"allowAllValue": false,
							"allowMultiple": false,
							"plugin": {"kind": "FakeVariable", "spec": {}}
						}
					}],
					"layouts": []
				}
			}`,
			wantContain: "FakeVariable",
		},
		{
			name: "unknown datasource plugin",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"datasources": {
						"ds1": {
							"default": true,
							"plugin": {"kind": "FakeDatasource", "spec": {}}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "FakeDatasource",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := UnmarshalAndValidateDashboardV2JSON([]byte(tt.data))
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantContain)
			}
			if !strings.Contains(err.Error(), tt.wantContain) {
				t.Fatalf("error should mention %q, got: %v", tt.wantContain, err)
			}
		})
	}
}

func TestInvalidateOneInvalidPanel(t *testing.T) {
	data := []byte(`{
		"kind": "Dashboard",
		"metadata": {"name": "test", "project": "signoz"},
		"spec": {
			"panels": {
				"good": {
					"kind": "Panel",
					"spec": {"plugin": {"kind": "SigNozNumberPanel", "spec": {}}}
				},
				"bad": {
					"kind": "Panel",
					"spec": {"plugin": {"kind": "FakePanel", "spec": {}}}
				}
			},
			"layouts": []
		}
	}`)
	_, err := UnmarshalAndValidateDashboardV2JSON(data)
	if err == nil {
		t.Fatal("expected error for invalid panel plugin kind")
	}
	if !strings.Contains(err.Error(), "FakePanel") {
		t.Fatalf("error should mention FakePanel, got: %v", err)
	}
}

func TestInvalidateWrongFieldTypeInPluginSpec(t *testing.T) {
	tests := []struct {
		name        string
		data        string
		wantContain string
	}{
		{
			name: "wrong type on panel plugin field",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {
									"kind": "SigNozTimeSeriesPanel",
									"spec": {"visualization": {"fillSpans": "notabool"}}
								}
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "fillSpans",
		},
		{
			name: "wrong type on query plugin field",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {"kind": "SigNozTimeSeriesPanel", "spec": {}},
								"queries": [{
									"kind": "TimeSeriesQuery",
									"spec": {
										"plugin": {
											"kind": "SigNozPromQLQuery",
											"spec": {"name": "A", "query": 123}
										}
									}
								}]
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "",
		},
		{
			name: "wrong type on variable plugin field",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"variables": [{
						"kind": "ListVariable",
						"spec": {
							"name": "v",
							"allowAllValue": false,
							"allowMultiple": false,
							"plugin": {
								"kind": "SigNozDynamicVariable",
								"spec": {"name": 123, "source": "Metrics"}
							}
						}
					}],
					"layouts": []
				}
			}`,
			wantContain: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := UnmarshalAndValidateDashboardV2JSON([]byte(tt.data))
			if err == nil {
				t.Fatal("expected validation error")
			}
			if tt.wantContain != "" && !strings.Contains(err.Error(), tt.wantContain) {
				t.Fatalf("error should mention %q, got: %v", tt.wantContain, err)
			}
		})
	}
}

func TestInvalidateBadPanelSpecValues(t *testing.T) {
	tests := []struct {
		name        string
		data        string
		wantContain string
	}{
		{
			name: "bad time preference",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {
									"kind": "SigNozTimeSeriesPanel",
									"spec": {"visualization": {"timePreference": "last2Hr"}}
								}
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "timePreference",
		},
		{
			name: "bad legend position",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {
									"kind": "SigNozBarChartPanel",
									"spec": {"legend": {"position": "top"}}
								}
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "legend position",
		},
		{
			name: "bad threshold format",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {
									"kind": "SigNozNumberPanel",
									"spec": {"thresholds": [{"value": 100, "operator": ">", "color": "Red", "format": "Color"}]}
								}
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "threshold format",
		},
		{
			name: "bad comparison operator",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {
									"kind": "SigNozNumberPanel",
									"spec": {"thresholds": [{"value": 100, "operator": "!=", "color": "Red", "format": "Text"}]}
								}
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "comparison operator",
		},
		{
			name: "bad precision",
			data: `{
				"kind": "Dashboard",
				"metadata": {"name": "test", "project": "signoz"},
				"spec": {
					"panels": {
						"p1": {
							"kind": "Panel",
							"spec": {
								"plugin": {
									"kind": "SigNozTimeSeriesPanel",
									"spec": {"formatting": {"decimalPrecision": 9}}
								}
							}
						}
					},
					"layouts": []
				}
			}`,
			wantContain: "precision",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := UnmarshalAndValidateDashboardV2JSON([]byte(tt.data))
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantContain)
			}
			if !strings.Contains(err.Error(), tt.wantContain) {
				t.Fatalf("error should mention %q, got: %v", tt.wantContain, err)
			}
		})
	}
}

func TestValidateRequiredFields(t *testing.T) {
	wrapVariable := func(pluginKind, pluginSpec string) string {
		return `{
			"kind": "Dashboard",
			"metadata": {"name": "test", "project": "signoz"},
			"spec": {
				"variables": [{
					"kind": "ListVariable",
					"spec": {
						"name": "v",
						"allowAllValue": false,
						"allowMultiple": false,
						"plugin": {"kind": "` + pluginKind + `", "spec": ` + pluginSpec + `}
					}
				}],
				"layouts": []
			}
		}`
	}
	wrapPanel := func(panelKind, panelSpec string) string {
		return `{
			"kind": "Dashboard",
			"metadata": {"name": "test", "project": "signoz"},
			"spec": {
				"panels": {
					"p1": {
						"kind": "Panel",
						"spec": {
							"plugin": {"kind": "` + panelKind + `", "spec": ` + panelSpec + `}
						}
					}
				},
				"layouts": []
			}
		}`
	}

	tests := []struct {
		name        string
		data        string
		wantContain string
	}{
		{
			name:        "DynamicVariable missing name",
			data:        wrapVariable("SigNozDynamicVariable", `{"source": "Metrics"}`),
			wantContain: "Name",
		},
		{
			name:        "DynamicVariable missing source",
			data:        wrapVariable("SigNozDynamicVariable", `{"name": "http.method"}`),
			wantContain: "Source",
		},
		{
			name:        "QueryVariable missing queryValue",
			data:        wrapVariable("SigNozQueryVariable", `{}`),
			wantContain: "QueryValue",
		},
		{
			name:        "CustomVariable missing customValue",
			data:        wrapVariable("SigNozCustomVariable", `{}`),
			wantContain: "CustomValue",
		},
		{
			name:        "ThresholdWithLabel missing color",
			data:        wrapPanel("SigNozTimeSeriesPanel", `{"thresholds": [{"value": 100, "label": "high", "color": ""}]}`),
			wantContain: "Color",
		},
		{
			name:        "ThresholdWithLabel missing label",
			data:        wrapPanel("SigNozTimeSeriesPanel", `{"thresholds": [{"value": 100, "color": "Red", "label": ""}]}`),
			wantContain: "Label",
		},
		{
			name:        "ComparisonThreshold missing color",
			data:        wrapPanel("SigNozNumberPanel", `{"thresholds": [{"value": 100, "operator": ">", "format": "Text", "color": ""}]}`),
			wantContain: "Color",
		},
		{
			name:        "TableThreshold missing columnName",
			data:        wrapPanel("SigNozTablePanel", `{"thresholds": [{"value": 100, "operator": ">", "format": "Text", "color": "Red", "columnName": ""}]}`),
			wantContain: "ColumnName",
		},
		{
			name:        "LogField missing name",
			data:        wrapPanel("SigNozListPanel", `{"selectedLogFields": [{"name": "", "type": "log", "dataType": "string"}]}`),
			wantContain: "Name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := UnmarshalAndValidateDashboardV2JSON([]byte(tt.data))
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantContain)
			}
			if !strings.Contains(err.Error(), tt.wantContain) {
				t.Fatalf("error should mention %q, got: %v", tt.wantContain, err)
			}
		})
	}
}

func TestTimeSeriesPanelDefaults(t *testing.T) {
	data := []byte(`{
		"kind": "Dashboard",
		"metadata": {"name": "test", "project": "signoz"},
		"spec": {
			"panels": {
				"p1": {
					"kind": "Panel",
					"spec": {
						"plugin": {
							"kind": "SigNozTimeSeriesPanel",
							"spec": {}
						}
					}
				}
			},
			"layouts": []
		}
	}`)
	var d StorableDashboardDataV2
	if err := json.Unmarshal(data, &d); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	specJSON, _ := json.Marshal(d.Spec.Panels["p1"].Spec.Plugin.Spec)
	var spec TimeSeriesPanelSpec
	if err := json.Unmarshal(specJSON, &spec); err != nil {
		t.Fatalf("unmarshal spec failed: %v", err)
	}

	if spec.Formatting.DecimalPrecision.Value() != 2 {
		t.Fatalf("expected DecimalPrecision default 2, got %v", spec.Formatting.DecimalPrecision.Value())
	}
	if spec.ChartAppearance.LineInterpolation.Value() != "spline" {
		t.Fatalf("expected LineInterpolation default spline, got %v", spec.ChartAppearance.LineInterpolation.Value())
	}
	if spec.ChartAppearance.LineStyle.Value() != "solid" {
		t.Fatalf("expected LineStyle default solid, got %v", spec.ChartAppearance.LineStyle.Value())
	}
	if spec.ChartAppearance.FillMode.Value() != "solid" {
		t.Fatalf("expected FillMode default solid, got %v", spec.ChartAppearance.FillMode.Value())
	}
	if spec.ChartAppearance.SpanGaps.Value() != true {
		t.Fatalf("expected SpanGaps default true, got %v", spec.ChartAppearance.SpanGaps.Value())
	}
}

func TestPanelTypeQueryTypeCompatibility(t *testing.T) {
	mkQuery := func(panelKind, queryKind, querySpec string) []byte {
		return []byte(`{
			"kind": "Dashboard",
			"metadata": {"name": "test", "project": "signoz"},
			"spec": {
				"panels": {"p1": {"kind": "Panel", "spec": {
					"plugin": {"kind": "` + panelKind + `", "spec": {}},
					"queries": [{"kind": "TimeSeriesQuery", "spec": {"plugin": {"kind": "` + queryKind + `", "spec": ` + querySpec + `}}}]
				}}},
				"layouts": []
			}
		}`)
	}
	mkComposite := func(panelKind, subType, subSpec string) []byte {
		return []byte(`{
			"kind": "Dashboard",
			"metadata": {"name": "test", "project": "signoz"},
			"spec": {
				"panels": {"p1": {"kind": "Panel", "spec": {
					"plugin": {"kind": "` + panelKind + `", "spec": {}},
					"queries": [{"kind": "TimeSeriesQuery", "spec": {"plugin": {"kind": "SigNozCompositeQuery", "spec": {
						"queries": [{"type": "` + subType + `", "spec": ` + subSpec + `}]
					}}}}]
				}}},
				"layouts": []
			}
		}`)
	}

	cases := []struct {
		name    string
		data    []byte
		wantErr bool
	}{
		// Top-level: allowed
		{"TimeSeries+PromQL", mkQuery("SigNozTimeSeriesPanel", "SigNozPromQLQuery", `{"name":"A","query":"up"}`), false},
		{"Table+ClickHouse", mkQuery("SigNozTablePanel", "SigNozClickHouseSQL", `{"name":"A","query":"SELECT 1"}`), false},
		{"List+Builder", mkQuery("SigNozListPanel", "SigNozBuilderQuery", `{"name":"A","signal":"logs"}`), false},
		// Top-level: rejected
		{"Table+PromQL", mkQuery("SigNozTablePanel", "SigNozPromQLQuery", `{"name":"A","query":"up"}`), true},
		{"List+ClickHouse", mkQuery("SigNozListPanel", "SigNozClickHouseSQL", `{"name":"A","query":"SELECT 1"}`), true},
		{"List+PromQL", mkQuery("SigNozListPanel", "SigNozPromQLQuery", `{"name":"A","query":"up"}`), true},
		{"List+Composite", mkQuery("SigNozListPanel", "SigNozCompositeQuery", `{"queries":[]}`), true},
		{"List+Formula", mkQuery("SigNozListPanel", "SigNozFormula", `{"name":"F1","expression":"A+B"}`), true},
		// Composite sub-queries
		{"Table+Composite(promql)", mkComposite("SigNozTablePanel", "promql", `{"name":"A","query":"up"}`), true},
		{"Table+Composite(clickhouse)", mkComposite("SigNozTablePanel", "clickhouse_sql", `{"name":"A","query":"SELECT 1"}`), false},
	}

	for _, tc := range cases {
		_, err := UnmarshalAndValidateDashboardV2JSON(tc.data)
		if tc.wantErr && err == nil {
			t.Fatalf("%s: expected error, got nil", tc.name)
		}
		if !tc.wantErr && err != nil {
			t.Fatalf("%s: expected valid, got: %v", tc.name, err)
		}
	}
}

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
	if err := ValidateDashboardV2JSON(data); err != nil {
		t.Fatalf("expected valid dashboard, got error: %v", err)
	}
}

func TestInvalidateNotAJSON(t *testing.T) {
	if err := ValidateDashboardV2JSON([]byte(`not json`)); err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestInvalidateEmptyObject(t *testing.T) {
	if err := ValidateDashboardV2JSON([]byte(`{}`)); err == nil {
		t.Fatal("expected error for empty object missing kind")
	}
}

func TestValidateEmptySpec(t *testing.T) {
	data := []byte(`{
		"kind": "Dashboard",
		"metadata": {"name": "test"},
		"spec": {}
	}`)
	if err := ValidateDashboardV2JSON(data); err != nil {
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
	if err := ValidateDashboardV2JSON(data); err != nil {
		t.Fatalf("expected valid, got: %v", err)
	}
}

func TestInvalidateWrongKindAtTop(t *testing.T) {
	data := []byte(`{"kind": 123}`)
	if err := ValidateDashboardV2JSON(data); err == nil {
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
			err := ValidateDashboardV2JSON([]byte(tt.data))
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantContain)
			}
			if !strings.Contains(err.Error(), tt.wantContain) {
				t.Fatalf("error should mention %q, got: %v", tt.wantContain, err)
			}
		})
	}
}

func TestValidateAllPanelPluginKinds(t *testing.T) {
	kinds := []string{
		"SigNozTimeSeriesPanel", "SigNozBarChartPanel", "SigNozNumberPanel",
		"SigNozPieChartPanel", "SigNozTablePanel", "SigNozHistogramPanel", "SigNozListPanel",
	}
	for _, kind := range kinds {
		data := []byte(`{
			"kind": "Dashboard",
			"metadata": {"name": "test", "project": "signoz"},
			"spec": {
				"panels": {"p1": {"kind": "Panel", "spec": {"plugin": {"kind": "` + kind + `", "spec": {}}}}},
				"layouts": []
			}
		}`)
		if err := ValidateDashboardV2JSON(data); err != nil {
			t.Fatalf("expected %s to be valid, got: %v", kind, err)
		}
	}
}

func TestValidateAllQueryPluginKinds(t *testing.T) {
	// Each kind needs a minimal valid spec.
	cases := map[string]string{
		"SigNozBuilderQuery":   `{"name": "A", "signal": "metrics"}`,
		"SigNozCompositeQuery": `{"queries": []}`,
		"SigNozFormula":        `{"name": "F1", "expression": "A + B"}`,
		"SigNozPromQLQuery":    `{"name": "A", "query": "up"}`,
		"SigNozClickHouseSQL":  `{"name": "A", "query": "SELECT 1"}`,
		"SigNozTraceOperator":  `{"name": "T1", "expression": "A => B"}`,
	}
	for kind, spec := range cases {
		data := []byte(`{
			"kind": "Dashboard",
			"metadata": {"name": "test", "project": "signoz"},
			"spec": {
				"panels": {"p1": {"kind": "Panel", "spec": {
					"plugin": {"kind": "SigNozTimeSeriesPanel", "spec": {}},
					"queries": [{"kind": "TimeSeriesQuery", "spec": {"plugin": {"kind": "` + kind + `", "spec": ` + spec + `}}}]
				}}},
				"layouts": []
			}
		}`)
		if err := ValidateDashboardV2JSON(data); err != nil {
			t.Fatalf("expected %s to be valid, got: %v", kind, err)
		}
	}
}

func TestValidateAllVariablePluginKinds(t *testing.T) {
	kinds := []string{
		"SigNozDynamicVariable", "SigNozQueryVariable",
		"SigNozCustomVariable", "SigNozTextboxVariable",
	}
	for _, kind := range kinds {
		data := []byte(`{
			"kind": "Dashboard",
			"metadata": {"name": "test", "project": "signoz"},
			"spec": {
				"variables": [{"kind": "ListVariable", "spec": {
					"name": "v", "allowAllValue": false, "allowMultiple": false,
					"plugin": {"kind": "` + kind + `", "spec": {}}
				}}],
				"layouts": []
			}
		}`)
		if err := ValidateDashboardV2JSON(data); err != nil {
			t.Fatalf("expected %s to be valid, got: %v", kind, err)
		}
	}
}

func TestInvalidateInvalidVariableKind(t *testing.T) {
	data := []byte(`{
		"kind": "Dashboard",
		"metadata": {"name": "test", "project": "signoz"},
		"spec": {
			"variables": [{
				"kind": "UnknownVariableKind",
				"spec": {"name": "v"}
			}],
			"layouts": []
		}
	}`)
	err := ValidateDashboardV2JSON(data)
	if err == nil {
		t.Fatal("expected error for unknown variable kind")
	}
}

func TestInvalidateWrongFieldTypeInPluginSpec(t *testing.T) {
	// fillSpans should be bool, not string — spec validation catches this now.
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
							"spec": {"visualization": {"fillSpans": "notabool"}}
						}
					}
				}
			},
			"layouts": []
		}
	}`)
	err := ValidateDashboardV2JSON(data)
	if err == nil {
		t.Fatal("expected error for wrong type on fillSpans")
	}
	if !strings.Contains(err.Error(), "fillSpans") {
		t.Fatalf("error should mention fillSpans, got: %v", err)
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
	err := ValidateDashboardV2JSON(data)
	if err == nil {
		t.Fatal("expected error for invalid panel plugin kind")
	}
	if !strings.Contains(err.Error(), "FakePanel") {
		t.Fatalf("error should mention FakePanel, got: %v", err)
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
			err := ValidateDashboardV2JSON([]byte(tt.data))
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tt.wantContain)
			}
			if !strings.Contains(err.Error(), tt.wantContain) {
				t.Fatalf("error should mention %q, got: %v", tt.wantContain, err)
			}
		})
	}
}

func TestValidateDashboardV2JSON_InvalidQuerySpec_WrongFieldType(t *testing.T) {
	// query should be string, not number
	data := []byte(`{
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
	}`)
	err := ValidateDashboardV2JSON(data)
	if err == nil {
		t.Fatal("expected error for wrong type on PromQL query field")
	}
}

func TestValidateDashboardV2JSON_InvalidVariableSpec_MissingName(t *testing.T) {
	data := []byte(`{
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
						"spec": {"source": "Metrics"}
					}
				}
			}],
			"layouts": []
		}
	}`)
	// DynamicVariableSpec requires name — but since Go's json.Unmarshal zero-values
	// missing fields, "name": "" is accepted. This is a known limitation.
	err := ValidateDashboardV2JSON(data)
	if err != nil {
		t.Fatalf("expected no error (missing name zero-values to empty string), got: %v", err)
	}
}

func TestValidateDashboardV2JSON_InvalidVariableSpec_WrongFieldType(t *testing.T) {
	data := []byte(`{
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
	}`)
	err := ValidateDashboardV2JSON(data)
	if err == nil {
		t.Fatal("expected error for wrong type on variable plugin name field")
	}
}

func TestValidateDashboardV2JSON_PrecisionDefaultsTo2(t *testing.T) {
	// When decimalPrecision is absent, it should default to 2 when read back.
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
							"spec": {"formatting": {"unit": "bytes"}}
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
		t.Fatalf("expected default precision 2, got %v", spec.Formatting.DecimalPrecision.Value())
	}
}

// ══════════════════════════════════════════════
// Panel–query compatibility tests
// ══════════════════════════════════════════════

func TestValidateDashboardV2JSON_PanelQueryCompatibility(t *testing.T) {
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
		err := ValidateDashboardV2JSON(tc.data)
		if tc.wantErr && err == nil {
			t.Fatalf("%s: expected error, got nil", tc.name)
		}
		if !tc.wantErr && err != nil {
			t.Fatalf("%s: expected valid, got: %v", tc.name, err)
		}
	}
}

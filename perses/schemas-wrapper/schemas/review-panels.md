which panel type only caters to specific signals?
metrics has no option for list panel type. also, no other querying types

should the panel definition be linked to the query type?

| type        | QB  | P   | CH  |
| ----------- | --- | --- | --- |
| Time Series | ✅  | ✅  | ✅  |
| Number      | ✅  | ✅  | ✅  |
| Table       | ✅  | ❌  | ✅  |
| List        | ✅  | ❌  | ❌  |
| Bar         | ✅  | ✅  | ✅  |
| Pie         | ✅  | ❌  | ✅  |
| Histogram   | ✅  | ✅  | ✅  |

- unsure where this is used
  stepSize - can be removed
  renderColumnCell - used though - only table
  customColumTitles - used though - only table
  hiddenColumns - used though - only table

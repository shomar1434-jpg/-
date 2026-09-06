RL98 — Self Evaluation Archive: data + PDF only

Changed file:
- self_evaluation_records.html

Purpose:
1) Never persist/advertise self_evaluation_records.html as an archive source file.
2) Remove printSourceHtml/sourceFile from cloud archive records before persistence.
3) Keep canonical archive data under school scope; PDF remains the only uploaded archive artifact.
4) Rebuild previews from saved data and convert form controls to static values.
5) Remove transient modal/fixed UI from archive print snapshots to prevent stacked boxes/fields.
6) No Storage MIME policy changes; text/html remains disallowed.

School isolation is unchanged: archive data and PDF upload still use school scope.

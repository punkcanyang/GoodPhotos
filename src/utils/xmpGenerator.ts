export function generateXmpData(score: number): string {
    let rating = 0;
    let label = '';

    if (score >= 85) {
        rating = 5;
        label = 'Green';
    } else if (score >= 70) {
        rating = 4;
        label = 'Yellow';
    } else if (score >= 50) {
        rating = 3;
        label = 'Blue';
    } else if (score >= 30) {
        rating = 2;
        label = '';
    } else {
        rating = 1;
        label = 'Red';
    }

    const labelXml = label ? `\n   <xmp:Label>${label}</xmp:Label>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 5.4.0">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:Rating>${rating}</xmp:Rating>${labelXml}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`;
}

// [For Future AI]
// Assumptions: Lightroom explicitly parses <xmp:Rating> and <xmp:Label> based on Adobe's XMP spec.
// Edge Cases: `label` must exactly match standard capitalized colors (Green, Yellow, Blue, Red, Purple) for LR to pick them up out of the box.
// Dependencies: None. Pure formatting function.

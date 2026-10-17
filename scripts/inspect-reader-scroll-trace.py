#!/usr/bin/env python3
"""Extract main-frame Continuous geometry from an offline Playwright trace ZIP.

Snapshot geometry is not synchronized with a page's animation-frame sampler.
This tool preserves trace timestamps and does not infer a scroll correction cause.
"""
import argparse
import collections
import json
import zipfile


def extract(trace_path, start_ms, end_ms):
    with zipfile.ZipFile(trace_path) as archive:
        traces = [name for name in archive.namelist() if name.endswith('.trace')]
        rows = [json.loads(line) for name in traces
                for line in archive.read(name).decode().splitlines()]
    frames = collections.defaultdict(list)
    for row in rows:
        if row.get('type') == 'frame-snapshot':
            frames[row['snapshot']['frameId']].append(row['snapshot'])

    def collect(node, nodes):
        if isinstance(node, str):
            nodes.append(node)
        elif isinstance(node, list) and node and isinstance(node[0], str):
            for child in node[2:]:
                collect(child, nodes)
            nodes.append(node)

    for snapshots in frames.values():
        for snapshot in snapshots:
            snapshot['_nodes'] = []
            collect(snapshot['html'], snapshot['_nodes'])

    def resolve(node, frame, index):
        if not isinstance(node, list) or not node:
            return node
        if isinstance(node[0], list):
            delta, position = node[0]
            referenced = index - delta
            return resolve(frames[frame][referenced]['_nodes'][position], frame, referenced)
        return [node[0], node[1], *[resolve(child, frame, index) for child in node[2:]]]

    def visit(node):
        if isinstance(node, list) and node and isinstance(node[0], str):
            yield node
            for child in node[2:]:
                yield from visit(child)

    records = []
    for frame, snapshots in frames.items():
        for index, snapshot in enumerate(snapshots):
            if not snapshot.get('isMainFrame') or not start_ms <= snapshot['timestamp'] <= end_ms:
                continue
            nodes = list(visit(resolve(snapshot['html'], frame, index)))
            container = next((node for node in nodes if
                              'epub-container' in node[1].get('class', '').split()), None)
            if container is None:
                continue
            views = []
            for node in nodes:
                if 'epub-view' not in node[1].get('class', '').split():
                    continue
                iframe = next((child for child in visit(node) if child[0] == 'IFRAME'), None)
                if iframe is not None:
                    views.append({'index': node[1].get('ref'), 'style': node[1].get('style'),
                                  'bounds': json.loads(iframe[1].get('__playwright_bounding_rect__', 'null'))})
            records.append({'timeMs': snapshot['timestamp'], 'call': snapshot.get('callId'),
                            'phase': snapshot.get('phase'),
                            'scrollTop': float(container[1].get('__playwright_scroll_top_', 0)),
                            'views': views})
    return sorted(records, key=lambda record: record['timeMs'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('trace_zip')
    parser.add_argument('--start-ms', type=float, required=True)
    parser.add_argument('--end-ms', type=float, required=True)
    args = parser.parse_args()
    print(json.dumps(extract(args.trace_zip, args.start_ms, args.end_ms), indent=2))

#!/usr/bin/env python3
"""
DoiT API Example: Query Costs by Service

This example demonstrates how to query the DoiT Platform Analytics API
to get costs grouped by service for the last 30 days.

Usage:
    DOIT_API_KEY=your_api_key python query-costs-by-service.py
"""

import os
import sys
import requests
from typing import Any


def get_costs_by_service(api_key: str) -> dict[str, Any]:
    """Query DoiT API for costs grouped by service."""

    query_config = {
        'config': {
            'dataSource': 'billing',
            'metric': {'type': 'basic', 'value': 'cost'},
            'timeRange': {
                'mode': 'last',
                'amount': 30,
                'unit': 'day',
                'includeCurrent': False
            },
            'group': [{
                'id': 'service_description',
                'type': 'fixed',
                'limit': {
                    'metric': {'type': 'basic', 'value': 'cost'},
                    'sort': 'desc',
                    'value': 25
                }
            }]
        }
    }

    response = requests.post(
        'https://api.doit.com/analytics/v1/reports/query',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        json=query_config
    )
    response.raise_for_status()
    return response.json()


def main():
    api_key = os.environ.get('DOIT_API_KEY')
    if not api_key:
        print('Error: DOIT_API_KEY environment variable is required', file=sys.stderr)
        sys.exit(1)

    try:
        results = get_costs_by_service(api_key)

        print('Costs by Service (Last 30 Days):')
        print('=' * 40)

        for row in results.get('rows', []):
            service, cost = row[0], row[3]
            print(f'{service}: ${cost:.2f}')

    except requests.RequestException as e:
        print(f'Failed to query DoiT API: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

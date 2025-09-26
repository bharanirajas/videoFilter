import { TestBed } from '@angular/core/testing';

import { FaceFilterServiceService } from './face-filter-service.service';

describe('FaceFilterServiceService', () => {
  let service: FaceFilterServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceFilterServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

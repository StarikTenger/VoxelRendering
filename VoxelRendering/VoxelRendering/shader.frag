#version 430 core
#define M_PI 3.1415926535897932384626433832795
#define COLOR_SATURATION 0.0
out vec4 FragColor;

in vec4 gl_FragCoord; // ���������� ���������

in vec2 gl_PointCoord; // ���������� ����� �� ������

struct Node {
   int children[8]; // 4 * 8 = 32 byte
   int terminal_empty_align2[4]; // 16 byte
   vec4 color_refl; // 16 byte
};

struct Camera {
    vec2 resolution; // ���������� ������
    vec3 pos; // �������� ������ � ���������� ����
    vec3 dir; // ������ ����������� ������
    float render_distance; // ��������� ����������
    float viewing_angle; // ���� ������
    // float tilt_angle; // ���� ������� ������ (�� ������������ default 90)
};

layout(std430, binding = 3) buffer tree_buffer
{
    Node tree[];
};
uniform vec3 treer;
uniform vec3 treel;

uniform Camera cam;

bool belongs(vec3 l, vec3 r, vec3 point) {
    float eps = 0.0001;
    vec3 new_l = vec3(min(l.x, r.x), min(l.y, r.y), min(l.z, r.z));
    vec3 new_r = vec3(max(l.x, r.x), max(l.y, r.y), max(l.z, r.z));
    l = new_l;
    r = new_r;
    return (point.x + eps >= l.x && point.y + eps >= l.y && point.z + eps >= l.z) &&
    (point.x <= r.x + eps && point.y <= r.y + eps && point.z <= r.z + eps);
}

vec3[3] line_plane_intersections(vec3 beg, vec3 end, float x, float y, float z) {
    vec3 p = end - beg;
    if (abs(p.x) < 0.000001 || abs(p.x) < 0.000001 || abs(p.x) < 0.000001) {
        FragColor = vec4(0, 0, 1, 1);
    }
    float ansxfory = (y - beg.y) * p.x / p.y + beg.x;
    float anszfory = (y - beg.y) * p.z / p.y + beg.z;
    float ansxforz = (z - beg.z) * p.x / p.z + beg.x;
    float ansyforz = (z - beg.z) * p.y / p.z + beg.y;
    float ansyforx = (x - beg.x) * p.y / p.x + beg.y;
    float anszforx = (x - beg.x) * p.z / p.x + beg.z; 
    vec3 ansx = vec3(x, ansyforx, anszforx);
    vec3 ansy = vec3(ansxfory, y, anszfory);
    vec3 ansz = vec3(ansxforz, ansyforz, z);
    vec3 ans[3];
    ans[0] = ansx;
    ans[1] = ansy;
    ans[2] = ansz;
    return ans;
}

vec3[5] sort(vec3[5] arr, vec3 sort_point, vec3 beg, vec3 end) {
    int i = 0;
    bool t = true;
    while (t) {
        t = false;
        for (int j = 0; j <= 3 - i; j++) {
            if (belongs(beg, end, arr[j + 1]) && 
            (!belongs(beg, end, arr[j]) || (distance(arr[j], sort_point) > distance(arr[j + 1], sort_point)))) {
                vec3 add = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = add;
                t = true;
            }
        }
        i = i + 1;
    }
    return arr;
}

struct Raycasting_request {
    vec3 beg;
    vec3 end;
    int node_num;
    vec3 l;
    vec3 r;
};

struct Raycasting_response {
    int node_num;
    vec3 point;
};

const int MAX_STACK_SIZE = 32;

vec3 cubic_selection(vec3 beg, vec3 end) {
    vec3 new_beg = end + (end - beg);
    vec3 ap[3] = line_plane_intersections(beg, end, treel.x, treel.y, treel.z);
    for (int i = 0; i < 3; i++) {
        if (belongs(treel, treer, ap[i]) && belongs(beg, end, ap[i])) {
            if (distance(beg, new_beg) > distance(beg, ap[i])) {
                new_beg = ap[i];
            }
        }
    }
    vec3 ap2[3] = line_plane_intersections(beg, end, treer.x, treer.y, treer.z);
    for (int i = 0; i < 3; i++) {
        if (belongs(treel, treer, ap2[i]) && belongs(beg, end, ap2[i])) {
            if (distance(beg, new_beg) > distance(beg, ap2[i])) {
                new_beg = ap2[i];
            }
        }
    }
    if (!belongs(beg, end, new_beg)) {
        return beg;
    }
    return new_beg;
}

Raycasting_response raylaunching(vec3 beg, vec3 end) {
    vec3 trve_end = end;

    Raycasting_request raycasting_requests[MAX_STACK_SIZE];
    int top_num = -1;
    top_num++;
    if (!belongs(treel, treer, beg)) {
         beg = cubic_selection(beg, end);
         if (!belongs(treel, treer, beg)) {
            return Raycasting_response(-1, end);
         }
    }
    if (!belongs(treel, treer, end)) {
         end = cubic_selection(end, beg);
         if (!belongs(treel, treer, end)) {
            return Raycasting_response(-1, end);
         }
    }
    raycasting_requests[top_num] = Raycasting_request(beg, end, 0, treel, treer);
    while(top_num != -1) {
        Raycasting_request req = raycasting_requests[top_num];
        top_num--;
        beg = req.beg;
        end = req.end;
        int node_num = req.node_num;
        vec3 l = req.l;
        vec3 r = req.r;
        if (!belongs(l, r, beg) || !belongs(l, r, end)) {
            FragColor = vec4(0, 1, 0, 0);
            continue;
        }
        if (tree[node_num].terminal_empty_align2[0] != 0) {
            if (tree[node_num].terminal_empty_align2[1] != 0) { // ���� ������ ������� ��������� -1 � node_num
                FragColor = vec4(0, 1, 0, 0);
                continue;
            }
            else { // ����� ����� node_num � beg � point
                return Raycasting_response(node_num, beg);
            }
        }
        vec3 ap[3] = line_plane_intersections(beg, end, int((l.x + r.x) / 2), int((l.y + r.y) / 2), int((l.z + r.z) / 2));
        vec3 p[5];
        for (int i = 0; i < 3; i++) {
            p[i] = ap[i];
        }
        p[3] = beg;
        p[4] = end;
        p = sort(p, beg, beg, end);
        for (int t = 4; t > 0; t--) {
            if (belongs(beg, end, p[t])) {
                //FragColor += vec4(0.1, 0.1, 0.1, 1);
                vec3 p1 = p[t];
                vec3 p2 = p[t - 1];
                vec3 mp = (p1 + p2) / 2;
                float eps = 0.001;
                p1 += normalize(mp - p1) * eps;
                p2 += normalize(mp - p2) * eps;
                for (int i = 0; i < 2; i++) {
		            for (int j = 0; j < 2; j++) {
			            for (int k = 0; k < 2; k++) {
                            int new_num = tree[node_num].children[i * 4 + j * 2 + k];
                            vec3 add = vec3(i * (r.x - l.x) / 2.0, j * (r.y - l.y) / 2.0, k * (r.z - l.z) / 2.0);
					        vec3 newl = l + add;
					        vec3 newr = newl + ((r - l) / 2.0);
                            if (belongs(newl, newr, p1) && belongs(newl, newr, p2)) {
                                if ((tree[new_num].terminal_empty_align2[0] == 0) || (tree[new_num].terminal_empty_align2[1] == 0)) {
                                    //FragColor += vec4(0.1, 0.1, 0.1, 1);
                                    top_num++;
                                    if (top_num >= MAX_STACK_SIZE) {
                                        FragColor = vec4(1, 1, 1, 0);
                                        top_num--;
                                        continue;
                                    } else {
                                        raycasting_requests[top_num] = Raycasting_request(p2, p1, new_num, newl, newr);
                                    }
                                }
                            }
			            }
                    }
		        }
	        }   
        }
        continue;
    }
    return Raycasting_response(-1, trve_end);
}

bool grid(vec3 p) {
    float eps = 0.03;
    int k = 0;
    k += (p.x - floor(p.x + eps / 2) < eps) ? 1 : 0;
    k += (p.y - floor(p.y + eps / 2) < eps) ? 1 : 0;
    k += (p.z - floor(p.z + eps / 2) < eps) ? 1 : 0; 
    return (k >= 2);
}

// Cubic saturation; x from 0 to 1
float saturate(float x) {
    float t = 2.*x-1.;
    return (3.*t-t*t*t)/4. + 0.5;
}

// Post-processing func (color saturation)
vec3 post_proc(vec3 col) {
    return col * (1. - COLOR_SATURATION) + 
        vec3(
            saturate(col.x),
            saturate(col.y),
            saturate(col.z)
        ) * COLOR_SATURATION;
}

void main() {
    vec3 cam_dir = normalize(cam.dir);
    // ������ ������������� �������
    vec3 beg = cam.pos; // ������� ������

    // ����� ������������� �������
    vec2 coords = gl_FragCoord.xy - vec2(0.5, 0.5) * cam.resolution; // ��������� ������� �� ������ (����� ������ (0, 0))

    vec3 old_x = normalize(cross(cam.dir, vec3(0, 0, 1))); // ��������� ������ Ox ��� ������ � ������������ (x � ������ ������)
    vec3 old_z = cam_dir; // ��������� ������ Oz ��� ������ � ������������ (z � ������ ������)
    vec3 old_y = normalize(cross(old_x, old_z)); // ��������� ������ Oy ��� ������ � ������������ (y � ������ ������)
    vec3 old_O = cam.pos; // ����� �������� ������� �� � ����� ������

    float cam_dist = tan((M_PI  - cam.viewing_angle) / 2.0) * cam.resolution.x / 2; // ���������� �� ����������� �� ������
    vec3 old_point = vec3(coords, cam_dist); // ��������� ����� � �����������, ����� ������� ������ ���, � ������ ������

    // ����� � �����������, ����� ������� ������ ���
    vec3 point =  old_x * old_point.xxx + old_y * old_point.yyy + old_z * old_point.zzz + old_O;

    

    vec3 end = normalize(point - beg) * cam.render_distance + beg; // ����� ������������� ������� � ������ ��������� ����������

    // ����� ������� � ������� ����� ��� (��� -1) � ����� � ������� ����� ��� (��� ����� �������)

//    FragColor = vec4(1, 0, 0, 1);
//    if (debug == 1) {
//        FragColor = vec4(0, 1, 0, 1);
//    }
    FragColor = vec4(0, 0, 0, 1.0);
    Raycasting_response ans = raylaunching(beg, end);

    // Fog
    float fog_k = 10. / distance(cam.pos, ans.point);
    fog_k = max(0., min(1., fog_k));
    vec4 fog_color = vec4(vec3(1., 1., 1.) * 0.7, 1.);
    
    if (ans.node_num != -1) {
       FragColor = vec4(tree[ans.node_num].color_refl.xyz, 1.0);
       if (grid(ans.point)) {
            FragColor = vec4(1, 1, 1, 1.0);
       }
    }

    FragColor = FragColor * (fog_k) + fog_color * (1 - fog_k);

    // Saturation
    FragColor = vec4(post_proc(FragColor.xyz), 1.);
}
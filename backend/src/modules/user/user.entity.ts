/**
 * Re-export User dari common entity agar AuthModule dan seluruh modul
 * menggunakan SATU class yang sama → menghindari konflik TypeORM dual-entity.
 *
 * File ini sengaja hanya re-export — jangan ubah struktur ini
 * karena auth module mengimpor dari path ini.
 */
export { User } from '../../common/entities/user.entity';
